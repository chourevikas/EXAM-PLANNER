import os
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from fastapi import HTTPException
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    QuestionMetadata,
    QuestionHierarchyLink,
    Subject,
    Topic,
    Subtopic,
)
from app.config.filename_parser import parse_question_paper_filename
from app.formatters.markdown_exporter import async_export_question_to_markdown
from app.formatters.yaml_exporter import get_canonical_question_filename_stem
from app.config.logger import setup_logger

logger = setup_logger("ExamExportService")


class ExamExportService:
    """Service handling generation of production-ready exam export ZIP archives."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def resolve_exam(self, exam_identifier: str) -> Exam:
        """
        Resolves an Exam record from various input formats:
        - 5-token filename: 'upsc_cse-prelims-gs1-2023-A.pdf' or 'upsc_cse-prelims-gs1-2023-A'
        - Canonical code: 'upsc_cse-prelims-gs1-2023-A'
        - Exam UUID string
        - Exam Name
        """
        clean_id = exam_identifier.strip()

        # 1. Try parsing 5-token filename format
        try:
            year_match = re.search(r"\b(19\d\d|20\d\d)\b", clean_id)
            if not year_match.group(1):
                raise ValueError("Exam year not found in identifier.")
            extracted_year = int(year_match.group(1))
            parsed = parse_question_paper_filename(clean_id, year=extracted_year)
            canonical_code = parsed["canonical_code"]
            stmt = select(Exam).where(Exam.code == canonical_code)
            exam = (await self.session.exec(stmt)).first()
            if exam:
                return exam
        except ValueError:
            pass

        # 2. Try directly matching Exam.code (case-insensitive)
        stmt = select(Exam).where(Exam.code == clean_id.lower())
        exam = (await self.session.exec(stmt)).first()
        if exam:
            return exam

        # 3. Try matching Exam.name
        stmt = select(Exam).where(Exam.name == clean_id)
        exam = (await self.session.exec(stmt)).first()
        if exam:
            return exam

        # 4. Try matching integer ID
        try:
            exam_id_int = int(clean_id)
            exam = await self.session.get(Exam, exam_id_int)
            if exam:
                return exam
        except ValueError:
            pass

        raise HTTPException(
            status_code=404,
            detail=f"Exam with identifier '{exam_identifier}' not found.",
        )

    async def create_exam_export_zip(self, exam_identifier: str) -> Tuple[Path, str]:
        """
        Generates a production-ready ZIP file containing all Pipeline 1-3 extracted data:
        - Per-question .md files (questions, options, correct answers, metadata, explanations, key takeaways, option analysis).
        - SUMMARY_WEIGHTAGE.md (Master answer key & complete Subject/Topic/Subtopic weightage breakdown).
        Returns a tuple of (temp_zip_path, download_filename).
        """
        exam = await self.resolve_exam(exam_identifier)

        questions_stmt = (
            select(Question)
            .where(Question.exam_id == exam.id)
            .order_by(col(Question.question_number_in_paper))
        )
        questions_res = await self.session.exec(questions_stmt)
        questions = questions_res.all()

        if not questions:
            raise HTTPException(
                status_code=404,
                detail=f"No questions found for exam '{exam.code}'.",
            )

        # Temp zip file creation
        temp_zip = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
        temp_zip_path = Path(temp_zip.name)
        temp_zip.close()

        subject_stats: Dict[str, Dict[str, Any]] = {}
        topic_stats: Dict[str, Dict[str, Any]] = {}
        subtopic_stats: Dict[str, Dict[str, Any]] = {}
        master_answer_key: List[Dict[str, Any]] = []

        total_weight_sum = 0.0

        q_ids = [q.id for q in questions]

        # 1. Bulk pre-fetch all options
        opts_by_qid: Dict[int, list[QuestionOption]] = {}
        if q_ids:
            all_opts_res = await self.session.exec(
                select(QuestionOption).where(QuestionOption.question_id.in_(q_ids))
            )
            for opt in all_opts_res.all():
                opts_by_qid.setdefault(opt.question_id, []).append(opt)

        # 2. Bulk pre-fetch all metadata
        meta_by_qid: Dict[int, QuestionMetadata] = {}
        if q_ids:
            all_meta_res = await self.session.exec(
                select(QuestionMetadata).where(QuestionMetadata.question_id.in_(q_ids))
            )
            for meta in all_meta_res.all():
                meta_by_qid[meta.question_id] = meta

        # 3. Bulk pre-fetch all hierarchy links
        links_by_qid: Dict[int, list[QuestionHierarchyLink]] = {}
        all_links = []
        if q_ids:
            all_links_res = await self.session.exec(
                select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id.in_(q_ids))
            )
            all_links = all_links_res.all()
            for link in all_links:
                links_by_qid.setdefault(link.question_id, []).append(link)

        # 4. Bulk pre-fetch all referenced taxonomy nodes in 3 queries
        subtop_ids = list({l.subtopic_id for l in all_links if l.subtopic_id})
        top_ids = list({l.topic_id for l in all_links if l.topic_id})
        subj_ids = list({l.subject_id for l in all_links if l.subject_id})

        subtops_map: Dict[int, Subtopic] = {}
        if subtop_ids:
            res_st = await self.session.exec(select(Subtopic).where(Subtopic.id.in_(subtop_ids)))
            subtops_map = {st.id: st for st in res_st.all()}

        tops_map: Dict[int, Topic] = {}
        if top_ids:
            res_t = await self.session.exec(select(Topic).where(Topic.id.in_(top_ids)))
            tops_map = {t.id: t for t in res_t.all()}

        subjs_map: Dict[int, Subject] = {}
        if subj_ids:
            res_s = await self.session.exec(select(Subject).where(Subject.id.in_(subj_ids)))
            subjs_map = {s.id: s for s in res_s.all()}

        with zipfile.ZipFile(temp_zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            for q in questions:
                q_stem = get_canonical_question_filename_stem(self.session, q, exam)
                md_content = await async_export_question_to_markdown(self.session, q)

                # Write question markdown file into zip
                md_filename = f"questions/{q_stem}.md"
                zip_file.writestr(md_filename, md_content)

                # Collect Correct Option
                opts = opts_by_qid.get(q.id, [])
                correct_opt = next((o.option_label for o in opts if o.is_correct), "N/A")

                # Collect Metadata
                q_meta = meta_by_qid.get(q.id)
                b_level = (
                    q_meta.blooms_level.value
                    if q_meta and hasattr(q_meta.blooms_level, "value")
                    else (str(q_meta.blooms_level) if q_meta else "N/A")
                )

                # Collect Hierarchy Links for Weightages
                links = links_by_qid.get(q.id, [])

                primary_topic_name = "General Concept"
                for link in links:
                    weight = link.relevance_weight or 1.0
                    total_weight_sum += weight

                    subtop = subtops_map.get(link.subtopic_id)
                    top = tops_map.get(link.topic_id)
                    subj = subjs_map.get(link.subject_id)

                    subj_name = subj.name if subj else "General Subject"
                    top_name = top.name if top else "General Topic"
                    subtop_name = subtop.name if subtop else "General Subtopic"

                    if link.is_primary:
                        primary_topic_name = top_name

                    # Subject Stats
                    if subj_name not in subject_stats:
                        subject_stats[subj_name] = {"count": 0, "weight": 0.0}
                    subject_stats[subj_name]["count"] += 1
                    subject_stats[subj_name]["weight"] += weight

                    # Topic Stats
                    if top_name not in topic_stats:
                        topic_stats[top_name] = {"count": 0, "weight": 0.0, "subject": subj_name}
                    topic_stats[top_name]["count"] += 1
                    topic_stats[top_name]["weight"] += weight

                    # Subtopic Stats
                    if subtop_name not in subtopic_stats:
                        subtopic_stats[subtop_name] = {"count": 0, "weight": 0.0, "topic": top_name, "subject": subj_name}
                    subtopic_stats[subtop_name]["count"] += 1
                    subtopic_stats[subtop_name]["weight"] += weight

                master_answer_key.append({
                    "q_num": q.question_number_in_paper,
                    "stem": q_stem,
                    "section": q.section_code or "DEFAULT",
                    "correct_option": correct_opt,
                    "blooms_level": b_level,
                    "primary_topic": primary_topic_name,
                })

            # Build SUMMARY_WEIGHTAGE.md
            summary_lines = []
            summary_lines.append(f"# 📚 Exam Summary & Weightage Breakdown: `{exam.name}`")
            summary_lines.append(f"**Exam Code:** `{exam.code}` | **Year:** `{exam.source_year}` | **Paper Set:** `{exam.paper_set_code}`")
            summary_lines.append(f"**Total Questions:** `{len(questions)}` | **Total Syllabus Links Evaluated:** `{int(total_weight_sum)}`")
            summary_lines.append("")
            summary_lines.append("---")
            summary_lines.append("")

            # 1. Subject Weightage Breakdown
            summary_lines.append("## 🏛️ 1. Subject Weightage Breakdown")
            summary_lines.append("| Subject Name | Question Links Count | Total Weight Points | % Share of Paper |")
            summary_lines.append("| :--- | :---: | :---: | :---: |")
            denom = total_weight_sum if total_weight_sum > 0 else 1.0
            for s_name, s_data in sorted(subject_stats.items(), key=lambda x: x[1]["weight"], reverse=True):
                pct = (s_data["weight"] / denom) * 100.0
                summary_lines.append(f"| **{s_name}** | `{s_data['count']}` | `{s_data['weight']:.2f}` | `{pct:.1f}%` |")
            summary_lines.append("")

            # 2. Topic Weightage Breakdown
            summary_lines.append("## 📖 2. Topic Weightage Breakdown")
            summary_lines.append("| Topic Name | Parent Subject | Question Links Count | Total Weight Points | % Share of Paper |")
            summary_lines.append("| :--- | :--- | :---: | :---: | :---: |")
            for t_name, t_data in sorted(topic_stats.items(), key=lambda x: x[1]["weight"], reverse=True):
                pct = (t_data["weight"] / denom) * 100.0
                summary_lines.append(f"| **{t_name}** | `{t_data['subject']}` | `{t_data['count']}` | `{t_data['weight']:.2f}` | `{pct:.1f}%` |")
            summary_lines.append("")

            # 3. Subtopic Weightage Breakdown
            summary_lines.append("## 📌 3. Subtopic Weightage Breakdown")
            summary_lines.append("| Subtopic Name | Parent Topic | Parent Subject | Links Count | Weight Points | % Share |")
            summary_lines.append("| :--- | :--- | :--- | :---: | :---: | :---: |")
            for st_name, st_data in sorted(subtopic_stats.items(), key=lambda x: x[1]["weight"], reverse=True):
                pct = (st_data["weight"] / denom) * 100.0
                summary_lines.append(f"| **{st_name}** | `{st_data['topic']}` | `{st_data['subject']}` | `{st_data['count']}` | `{st_data['weight']:.2f}` | `{pct:.1f}%` |")
            summary_lines.append("")

            # 4. Master Answer Key & Index
            summary_lines.append("## 🗝️ 4. Master Answer Key & Question Index")
            summary_lines.append("| Q# | Canonical Stem ID | Correct Option | Section | Bloom's Level | Primary Topic |")
            summary_lines.append("| :---: | :--- | :---: | :---: | :---: | :--- |")
            for item in master_answer_key:
                summary_lines.append(
                    f"| `{item['q_num']:03d}` | `{item['stem']}` | **{item['correct_option']}** | `{item['section']}` | `{item['blooms_level']}` | {item['primary_topic']} |"
                )
            summary_lines.append("")

            summary_content = "\n".join(summary_lines)
            zip_file.writestr("SUMMARY_WEIGHTAGE.md", summary_content)

        download_filename = f"{exam.code}_export_bundle.zip"
        return temp_zip_path, download_filename
