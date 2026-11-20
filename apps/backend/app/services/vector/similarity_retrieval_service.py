import math
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.config.settings import get_settings
from app.db.models.question import Question, QuestionTranslation, QuestionOption, OptionTranslation
from app.db.models.explanation import QuestionExplanation
from app.db.models.question_embedding import QuestionEmbedding
from app.db.models.enums import LanguageCode, QuestionStatus
from app.services.vector.bm25 import bm25_search, bm25_stats_ready
from app.services.vector.gemini_embedder import GeminiEmbedder
from app.services.vector.jina_reranker import JinaReranker
from app.core.subjects import canonical_subject, subject_sql_expr

logger = setup_logger("SimilarityRetrievalService")

# Words that only make up "code" answers: "1 and 2 only", "Only two", "Neither 1 nor 2",
# "Statement-I is correct but Statement-II is incorrect", "Both A and R are true ...", "A-1, B-2 ...".
_ANSWER_CODE_WORDS = {
    "a", "b", "c", "d", "r", "i", "ii", "iii", "iv", "v", "vi",
    "and", "or", "only", "both", "neither", "nor", "none", "all", "of", "the", "above", "these", "those",
    "one", "two", "three", "four", "five", "statement", "statements", "pair", "pairs", "code", "codes",
    "is", "are", "not", "but", "correct", "incorrect", "true", "false", "individually", "explanation",
    "given", "list", "match", "matched", "properly", "assertion", "reason",
}

# The per-question subject (same rule as _resolve_target_subject and the question cards): the subject of the
# question's own syllabus subtopic, which an admin's correction updates; else the PDF's subject tag
_QUESTION_SUBJECT_SQL = "COALESCE(s.name, NULLIF(btrim(q.subject_raw), ''))"


def is_informative_answer(answer: Optional[str]) -> bool:
    """False for answers that are only option codes, so they are never used as search queries.

    "1 and 2 only" matched against other answers would link every question whose answer is
    "1 and 2 only", whatever the topic. Real answers ("Chandragupta Maurya", "Article 21") pass.
    """
    tokens = re.findall(r"[a-z]+|\d+", (answer or "").lower())
    return any(not t.isdigit() and t not in _ANSWER_CODE_WORDS for t in tokens)


class HybridSimilarityService:
    """
    Hybrid similar-question search: 5 retrieval channels -> weighted Reciprocal Rank Fusion ->
    Jina reranking. Candidates are restricted to the target question's subject.

    Channels (weights from settings; 0 disables a channel):
      q_dense              question vector  vs other questions' vectors   (same topic / wording)
      q_bm25               question text    vs other questions' text      (BM25: shared names, terms)
      expl_dense           solution vector  vs other solutions' vectors   (same underlying fact)
      ans_bm25             correct answer   vs other correct answers      (BM25: same answer)
      ans_in_question_bm25 correct answer   vs other questions' text      (BM25: the answer is asked about)
    The two answer channels are skipped when the answer is only a code ("1 and 2 only", "Only two").
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.embedder = GeminiEmbedder()
        self.reranker = JinaReranker()

        s = self.settings
        self.weights = {
            "q_dense": s.SIMILARITY_WEIGHT_QUESTION_DENSE,
            "q_bm25": s.SIMILARITY_WEIGHT_QUESTION_BM25,
            "expl_dense": s.SIMILARITY_WEIGHT_EXPLANATION_DENSE,
            "ans_bm25": s.SIMILARITY_WEIGHT_ANSWER_BM25,
            "ans_in_question_bm25": s.SIMILARITY_WEIGHT_ANSWER_IN_QUESTION_BM25,
        }
        self.k1 = s.SIMILARITY_BM25_K1
        self.b = s.SIMILARITY_BM25_B
        self.k = s.SIMILARITY_RRF_K
        self.channel_limit = s.SIMILARITY_CHANNEL_LIMIT
        self.rerank_top_n = s.SIMILARITY_RERANK_TOP_N
        self.final_limit = s.SIMILARITY_FINAL_LIMIT

    async def _get_or_create_target_representation(
        self, question_id: int
    ) -> Optional[Dict[str, Any]]:
        """Texts and vectors of the target question (vectors generated on the fly if not stored yet)."""
        q_emb = await self.session.get(QuestionEmbedding, question_id)

        trans_rows = (await self.session.exec(
            select(QuestionTranslation.language, QuestionTranslation.question_text)
            .where(QuestionTranslation.question_id == question_id)
        )).all()
        q_text = ""
        for lang, txt in trans_rows:
            if not q_text or lang == LanguageCode.ENGLISH:
                q_text = txt

        ans_rows = (await self.session.exec(
            select(OptionTranslation.language, OptionTranslation.option_text)
            .join(QuestionOption, QuestionOption.id == OptionTranslation.option_id)
            .where(
                QuestionOption.question_id == question_id,
                QuestionOption.is_correct.is_(True),
            )
        )).all()
        ans_text = ""
        for lang, txt in ans_rows:
            if not ans_text or lang == LanguageCode.ENGLISH:
                ans_text = txt

        expl_rows = (await self.session.exec(
            select(QuestionExplanation.language, QuestionExplanation.detailed_solution)
            .where(QuestionExplanation.question_id == question_id)
        )).all()
        expl_text = ""
        for lang, txt in expl_rows:
            if txt and (not expl_text or lang == LanguageCode.ENGLISH):
                expl_text = txt

        if not q_text:
            logger.warning(f"Question #{question_id} has no text translation available.")
            return None

        q_vec = q_emb.question_dense_embedding if q_emb is not None else None
        expl_vec = q_emb.explanation_dense_embedding if q_emb is not None else None

        if q_vec is None:
            logger.info(f"Target Q#{question_id} has no question vector yet. Embedding on the fly...")
            q_vec = await self.embedder.embed_text(q_text)
        if expl_vec is None and expl_text:
            from app.scripts.backfill_question_embeddings import explanation_text_for_embedding
            logger.info(f"Target Q#{question_id} has no solution vector yet. Embedding on the fly...")
            expl_vec = await self.embedder.embed_text(explanation_text_for_embedding(expl_text))

        return {
            "question_id": question_id,
            "question_text": q_text,
            "answer_text": ans_text,
            "explanation_text": expl_text,
            "question_dense_embedding": q_vec,
            "explanation_dense_embedding": expl_vec,
        }

    async def _resolve_target_subject(self, question_id: int) -> Optional[str]:
        """Normalized subject name of the question: its syllabus subject first, else the PDF subject tag."""
        row = (await self.session.exec(
            text("""
                SELECT q.subject_raw, s.name
                FROM questions q
                LEFT JOIN subtopics st ON st.id = q.subtopic_id
                LEFT JOIN topics t ON t.id = st.topic_id
                LEFT JOIN subjects s ON s.id = t.subject_id
                WHERE q.id = :qid
            """),
            params={"qid": question_id},
        )).first()
        if not row:
            return None
        subject_raw, hierarchy_name = row
        name = hierarchy_name or (subject_raw if subject_raw and subject_raw.strip() else None)
        return canonical_subject(name)

    async def _get_allowed_subject_qids(
        self, subject_key: str, exclude_qid: int, other_years_only: bool = False
    ) -> List[int]:
        """IDs of all other published questions whose normalized subject name is exactly `subject_key`.

        Only PUBLISHED questions can be suggested (questions still in review are never shown to
        students); the target itself may be unpublished, e.g. when an admin previews it.
        `other_years_only` ("same theme in other years") also drops the target's own paper and year
        here, before ranking, so the few other-year matches are not crowded out of the top results.
        """
        params: Dict[str, Any] = {
            "subject": subject_key,
            "exclude_id": exclude_qid,
            "published": QuestionStatus.PUBLISHED.value,
        }
        year_clause = ""
        if other_years_only:
            own = (await self.session.exec(
                text("""
                    SELECT q.exam_id, COALESCE(q.source_year, e.source_year)
                    FROM questions q LEFT JOIN exams e ON e.id = q.exam_id WHERE q.id = :qid
                """),
                params={"qid": exclude_qid},
            )).first()
            if own:
                params["own_exam"] = own[0]
                year_clause = "AND q.exam_id IS DISTINCT FROM :own_exam"
                if own[1] is not None:
                    params["own_year"] = own[1]
                    year_clause += " AND COALESCE(q.source_year, e.source_year) IS DISTINCT FROM :own_year"
        cand_sql = text(f"""
            SELECT q.id
            FROM questions q
            LEFT JOIN exams e ON e.id = q.exam_id
            LEFT JOIN subtopics st ON st.id = q.subtopic_id
            LEFT JOIN topics t ON t.id = st.topic_id
            LEFT JOIN subjects s ON s.id = t.subject_id
            WHERE q.id != :exclude_id
              AND CAST(q.status AS text) = :published
              AND {subject_sql_expr(_QUESTION_SUBJECT_SQL)} = :subject
              {year_clause}
        """)
        cand_res = await self.session.exec(cand_sql, params=params)
        return [r[0] for r in cand_res.fetchall()]

    async def _retrieve_dense(
        self,
        column: str,
        target_vec: List[float],
        exclude_qid: int,
        limit: int,
        allowed_qids: List[int],
    ) -> List[int]:
        """Exact nearest neighbours among the allowed (same-subject) questions.

        The MATERIALIZED pool keeps the planner from using the HNSW index here: an HNSW scan only
        looks at ~ef_search nearest rows and filters afterwards, which loses most same-subject matches.
        A subject has at most a few thousand questions, so an exact scan stays fast.
        """
        if column not in ("question_dense_embedding", "explanation_dense_embedding"):
            raise ValueError(f"Unexpected vector column {column}")
        if not allowed_qids:
            return []
        vec_str = f"[{','.join(str(x) for x in target_vec)}]"
        sql = text(f"""
            WITH pool AS MATERIALIZED (
                SELECT question_id, {column} AS emb
                FROM question_embeddings
                WHERE question_id != :exclude_id
                  AND question_id = ANY(:allowed_qids)
                  AND {column} IS NOT NULL
            )
            SELECT question_id
            FROM pool
            ORDER BY emb <=> CAST(:vec AS halfvec)
            LIMIT :limit;
        """)
        res = await self.session.exec(
            sql, params={"exclude_id": exclude_qid, "allowed_qids": allowed_qids, "vec": vec_str, "limit": limit}
        )
        return [r[0] for r in res.fetchall()]

    async def _retrieve_bm25(
        self, field: str, query_text: str, exclude_qid: int, limit: int, allowed_qids: List[int]
    ) -> List[int]:
        rows = await bm25_search(
            self.session, field, query_text, exclude_qid, limit, allowed_ids=allowed_qids, k1=self.k1, b=self.b
        )
        return [qid for qid, _ in rows]

    async def find_similar_questions(
        self,
        question_id: int,
        limit: Optional[int] = None,
        include_question: bool = True,
        target_lang: LanguageCode = LanguageCode.ENGLISH,
        other_years_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Parallel channel retrieval -> weighted RRF -> Jina reranking, strictly within the target's subject
        (and, with `other_years_only`, outside its own paper and year).
        Returns a list of dicts formatted for the frontend recommendation cards.
        """
        final_k = limit or self.final_limit
        if self.session.get_bind().dialect.name != "postgresql":
            # pgvector / tsvector search needs PostgreSQL (e.g. the SQLite test database)
            return []
        target = await self._get_or_create_target_representation(question_id)
        if not target:
            return []

        # ── Subject isolation: only questions with exactly the same subject name ──
        subject_key = await self._resolve_target_subject(question_id)
        if not subject_key:
            logger.info(f"Q#{question_id} has no subject; no same-subject suggestions possible.")
            return []
        allowed_qids = await self._get_allowed_subject_qids(
            subject_key, exclude_qid=question_id, other_years_only=other_years_only
        )
        if not allowed_qids:
            logger.info(f"No other questions in subject '{subject_key}' for Q#{question_id}")
            return []
        logger.info(f"Target Q#{question_id} subject='{subject_key}'. Filtered to {len(allowed_qids)} candidates.")

        answer_query = target["answer_text"] if is_informative_answer(target["answer_text"]) else ""
        bm25_ready = {
            field: await bm25_stats_ready(self.session, field) for field in ("question", "answer")
        }
        if not all(bm25_ready.values()):
            logger.warning(
                f"BM25 statistics missing for {[f for f, ok in bm25_ready.items() if not ok]}; "
                "run `python -m app.scripts.backfill_question_embeddings --refresh-bm25-only`."
            )

        # Channel name -> coroutine, for every channel that has a weight and an input
        planned = {
            "q_dense": (
                target["question_dense_embedding"] is not None,
                lambda: self._retrieve_dense(
                    "question_dense_embedding", target["question_dense_embedding"],
                    question_id, self.channel_limit, allowed_qids,
                ),
            ),
            "q_bm25": (
                bool(target["question_text"]) and bm25_ready["question"],
                lambda: self._retrieve_bm25("question", target["question_text"], question_id, self.channel_limit, allowed_qids),
            ),
            "expl_dense": (
                target["explanation_dense_embedding"] is not None,
                lambda: self._retrieve_dense(
                    "explanation_dense_embedding", target["explanation_dense_embedding"],
                    question_id, self.channel_limit, allowed_qids,
                ),
            ),
            "ans_bm25": (
                bool(answer_query) and bm25_ready["answer"],
                lambda: self._retrieve_bm25("answer", answer_query, question_id, self.channel_limit, allowed_qids),
            ),
            "ans_in_question_bm25": (
                bool(answer_query) and bm25_ready["question"],
                lambda: self._retrieve_bm25("question", answer_query, question_id, self.channel_limit, allowed_qids),
            ),
        }
        task_channels = [
            (name, self.weights[name]) for name, (has_input, _) in planned.items()
            if has_input and self.weights[name] > 0
        ]
        # One AsyncSession cannot run statements concurrently, so the channels run one after another
        results_lists = []
        for name, _ in task_channels:
            results_lists.append(await planned[name][1]())

        # ── Weighted Reciprocal Rank Fusion (RRF) ──────────────────────────────
        rrf_scores: Dict[int, float] = defaultdict(float)
        channel_appearances: Dict[int, List[str]] = defaultdict(list)

        for (channel_name, weight), id_list in zip(task_channels, results_lists):
            for rank_idx, qid in enumerate(id_list, start=1):
                # RRF Formula: weight / (k + rank)
                rrf_scores[qid] += weight / (self.k + rank_idx)
                channel_appearances[qid].append(channel_name)

        logger.info(
            f"Q#{question_id} channels: "
            + ", ".join(f"{name}={len(ids)}" for (name, _), ids in zip(task_channels, results_lists))
        )

        if not rrf_scores:
            logger.info(f"No similar candidates found across channels for Q#{question_id}")
            return []

        # Sort all candidates by descending fusion score
        sorted_candidates = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        top_candidates = sorted_candidates[: self.rerank_top_n]
        cand_qids = [c[0] for c in top_candidates]

        # ── Fetch candidate texts for Reranking ────────────────────────────────
        cand_questions = (await self.session.exec(
            select(Question).where(col(Question.id).in_(cand_qids))
        )).all()
        q_map = {q.id: q for q in cand_questions}

        cand_trans = (await self.session.exec(
            select(QuestionTranslation).where(col(QuestionTranslation.question_id).in_(cand_qids))
        )).all()
        trans_map = {}
        for t in cand_trans:
            if t.question_id not in trans_map or t.language == LanguageCode.ENGLISH:
                trans_map[t.question_id] = t.question_text

        # Fetch candidate correct answers
        cand_opts = (await self.session.exec(
            select(QuestionOption.question_id, OptionTranslation.language, OptionTranslation.option_text)
            .join(OptionTranslation, OptionTranslation.option_id == QuestionOption.id)
            .where(
                QuestionOption.question_id.in_(cand_qids),
                QuestionOption.is_correct.is_(True),
            )
        )).all()
        ans_map: Dict[int, str] = {}
        for qid, lang, txt in cand_opts:
            if qid not in ans_map or lang == LanguageCode.ENGLISH:
                ans_map[qid] = txt

        # Build candidate documents for Jina Reranker
        rerank_docs = []
        valid_cands = []
        for qid, _ in top_candidates:
            if qid in q_map:
                stem = trans_map.get(qid, "")
                ans = ans_map.get(qid, "")
                doc_text = f"Question: {stem}\nCorrect Answer: {ans}"
                rerank_docs.append(doc_text)
                valid_cands.append(qid)

        # ── Jina AI Reranker Stage ─────────────────────────────────────────────
        query_text = f"Question: {target['question_text']}\nCorrect Answer: {target['answer_text']}"
        rerank_results = await self.reranker.rerank(
            query=query_text,
            documents=rerank_docs,
            top_n=final_k,
        )

        final_matches = []
        for res in rerank_results:
            idx = res.get("index", 0)
            if idx < len(valid_cands):
                qid = valid_cands[idx]
                rel_score = float(res.get("relevance_score", 0.0))
                # Calibrated logistic sigmoid mapping for Jina Reranker v3.5 logits
                # maps logits to realistic percentage distribution (approx 55% - 95%)
                p = 1.0 / (1.0 + math.exp(-4.5 * (rel_score - 0.05)))
                norm_score = int(round(40 + 58 * p))
                norm_score = max(40, min(99, norm_score))

                channels_matched = channel_appearances.get(qid, [])

                final_matches.append({
                    "question_id": qid,
                    "similarity_score": norm_score,
                    "match_reasons": [f"Matched via {c}" for c in channels_matched],
                    "raw_score": rel_score,
                })

        # ── Build Question Cards for Frontend (matching QuestionService schema) ─
        if include_question and final_matches:
            from app.services.question_service import QuestionService
            service = QuestionService(self.session)
            matched_qids = [m["question_id"] for m in final_matches]
            ordered_q_rows = [q_map[qid] for qid in matched_qids if qid in q_map]
            cards = await service._build_light_recommendation_cards(ordered_q_rows, target_lang=target_lang)
            by_id = {int(c["question_id"]): c for c in cards if c.get("question_id")}

            results = []
            for m in final_matches:
                qid = m["question_id"]
                results.append({
                    "question_id": qid,
                    "tier": "exact" if m["similarity_score"] >= 85 else "related",
                    "similarity_score": m["similarity_score"],
                    "match_reasons": m["match_reasons"],
                    "question": by_id.get(qid),
                })
            return results

        return final_matches
