"""
Translate a complete exam offline using open-source MarianMT models.
Zero cloud API costs, zero token limits, zero external calls.
Supports Hindi (hi) and Marathi (mr).
"""

import sys
import time
import asyncio
import argparse
from typing import List, Dict
from sqlmodel import select, col
from app.db.session import managed_async_session
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption, QuestionTranslation, OptionTranslation, LanguageCode
from app.services.open_source_translation_service import OpenSourceTranslationService
from app.config.logger import setup_logger

logger = setup_logger("TranslateExamOffline")


async def translate_exam_offline(
    exam_id: int,
    target_languages: List[str] = ["hi", "mr"],
    batch_size: int = 16,
):
    print(f"\n=======================================================")
    print(f"🚀 Starting Offline Open-Source Exam Translation")
    print(f"Exam ID: {exam_id} | Target Languages: {target_languages}")
    print(f"=======================================================\n")

    t_start = time.time()
    translator = OpenSourceTranslationService()

    async with managed_async_session() as session:
        exam = await session.get(Exam, exam_id)
        if not exam:
            print(f"❌ Exam #{exam_id} not found in database.")
            return

        print(f"📋 Exam: {exam.name} (Code: {exam.code}, Year: {exam.source_year})")

        # 1. Fetch questions and English translations
        q_stmt = select(Question).where(Question.exam_id == exam_id).order_by(Question.question_number_in_paper)
        questions = (await session.exec(q_stmt)).all()
        if not questions:
            print(f"❌ No questions found for Exam #{exam_id}.")
            return

        q_ids = [q.id for q in questions]
        print(f"Found {len(questions)} questions in exam.")

        # 2. Fetch options
        opt_stmt = select(QuestionOption).where(col(QuestionOption.question_id).in_(q_ids)).order_by(QuestionOption.display_order)
        options = (await session.exec(opt_stmt)).all()
        opt_ids = [o.id for o in options]
        print(f"Found {len(options)} options across all questions.")

        # 3. Fetch English base texts
        eng_q_stmt = select(QuestionTranslation).where(
            col(QuestionTranslation.question_id).in_(q_ids),
            QuestionTranslation.language == LanguageCode.ENGLISH,
        )
        eng_q_trans = (await session.exec(eng_q_stmt)).all()
        q_eng_map = {qt.question_id: qt.question_text for qt in eng_q_trans}

        eng_opt_stmt = select(OptionTranslation).where(
            col(OptionTranslation.option_id).in_(opt_ids),
            OptionTranslation.language == LanguageCode.ENGLISH,
        )
        eng_opt_trans = (await session.exec(eng_opt_stmt)).all()
        opt_eng_map = {ot.option_id: ot.option_text for ot in eng_opt_trans}

        # For each language:
        for lang_code in target_languages:
            lang_enum_str = "HINDI" if lang_code == "hi" else "MARATHI" if lang_code == "mr" else lang_code.upper()
            lang_enum = LanguageCode[lang_enum_str]
            lang_name = "Hindi" if lang_code == "hi" else "Marathi"

            print(f"\n🔄 Translating complete exam into {lang_name} ({lang_code})...")
            l_start = time.time()

            # Prepare question texts
            q_to_translate = []
            for q in questions:
                txt = q_eng_map.get(q.id, f"Question {q.question_number_in_paper}")
                q_to_translate.append(txt)

            # Prepare option texts
            opt_to_translate = []
            for opt in options:
                txt = opt_eng_map.get(opt.id, f"Option {opt.option_label}")
                opt_to_translate.append(txt)

            # Batch translate questions
            print(f"  -> Translating {len(q_to_translate)} question stems (batch_size={batch_size})...")
            q_trans_results = await translator.translate_batch(
                q_to_translate,
                target_language=lang_code,
                source_language="en",
                batch_size=batch_size,
            )

            # Batch translate options
            print(f"  -> Translating {len(opt_to_translate)} option texts (batch_size={batch_size})...")
            opt_trans_results = await translator.translate_batch(
                opt_to_translate,
                target_language=lang_code,
                source_language="en",
                batch_size=batch_size,
            )

            # Upsert Question Translations into database
            print(f"  -> Saving {len(q_trans_results)} question translations to DB...")
            existing_qt_stmt = select(QuestionTranslation).where(
                col(QuestionTranslation.question_id).in_(q_ids),
                QuestionTranslation.language == lang_enum,
            )
            existing_qts = {qt.question_id: qt for qt in (await session.exec(existing_qt_stmt)).all()}

            for q, t_text in zip(questions, q_trans_results):
                if q.id in existing_qts:
                    existing_qts[q.id].question_text = t_text
                    session.add(existing_qts[q.id])
                else:
                    new_qt = QuestionTranslation(
                        question_id=q.id,
                        language=lang_enum,
                        question_text=t_text,
                    )
                    session.add(new_qt)

            # Upsert Option Translations into database
            print(f"  -> Saving {len(opt_trans_results)} option translations to DB...")
            existing_ot_stmt = select(OptionTranslation).where(
                col(OptionTranslation.option_id).in_(opt_ids),
                OptionTranslation.language == lang_enum,
            )
            existing_ots = {ot.option_id: ot for ot in (await session.exec(existing_ot_stmt)).all()}

            for opt, t_text in zip(options, opt_trans_results):
                if opt.id in existing_ots:
                    existing_ots[opt.id].option_text = t_text
                    session.add(existing_ots[opt.id])
                else:
                    new_ot = OptionTranslation(
                        option_id=opt.id,
                        language=lang_enum,
                        option_text=t_text,
                    )
                    session.add(new_ot)

            await session.commit()
            l_duration = time.time() - l_start
            print(f"  ✅ Completed {lang_name} in {l_duration:.2f}s ({len(questions)} questions + {len(options)} options)")

    total_duration = time.time() - t_start
    print(f"\n=======================================================")
    print(f"🎉 Complete Exam #{exam_id} Offline Translation Finished!")
    print(f"Total Questions Translated: {len(questions)}")
    print(f"Total Options Translated: {len(options)}")
    print(f"Languages: {', '.join(target_languages)}")
    print(f"Total Time Taken: {total_duration:.2f}s")
    print(f"Total Cloud API Cost: $0.00 (100% Free Open Source)")
    print(f"=======================================================\n")

    # Print sample translation
    async with managed_async_session() as session:
        sample_q = questions[0]
        q_trans = (await session.exec(
            select(QuestionTranslation).where(QuestionTranslation.question_id == sample_q.id)
        )).all()
        print("SAMPLE OUTPUT (Question 1):")
        for qt in q_trans:
            lang_label = qt.language.value if hasattr(qt.language, "value") else str(qt.language)
            print(f"[{lang_label}]: {qt.question_text[:120]}...")

        sample_opts = (await session.exec(
            select(QuestionOption).where(QuestionOption.question_id == sample_q.id).order_by(QuestionOption.display_order)
        )).all()
        print("\nOPTIONS (Question 1):")
        for o in sample_opts:
            o_trans = (await session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id == o.id)
            )).all()
            opt_labels = {
                (ot.language.value if hasattr(ot.language, "value") else str(ot.language)): ot.option_text
                for ot in o_trans
            }
            print(f"  ({o.option_label}) EN: {opt_labels.get('ENGLISH', '')[:40]}")
            print(f"      HI: {opt_labels.get('HINDI', '')[:40]}")
            print(f"      MR: {opt_labels.get('MARATHI', '')[:40]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Translate an exam completely offline")
    parser.add_argument("--exam-id", type=int, default=97, help="ID of the exam to translate")
    parser.add_argument("--langs", nargs="+", default=["hi", "mr"], help="Target languages (e.g. hi mr)")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for local inference")
    args = parser.parse_args()

    asyncio.run(translate_exam_offline(
        exam_id=args.exam_id,
        target_languages=args.langs,
        batch_size=args.batch_size,
    ))
