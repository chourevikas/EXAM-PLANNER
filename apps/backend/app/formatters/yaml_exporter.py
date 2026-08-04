import yaml
from typing import Dict, Any
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Question, QuestionTranslation, QuestionOption, OptionTranslation,
    Subtopic, Topic, Subject, Exam, QuestionAsset
)



def json_first_page(page_numbers_json: str) -> int:
    import json
    try:
        pages = json.loads(page_numbers_json)
        return pages[0] if pages else 1
    except Exception:
        return 1


def get_canonical_question_filename_stem(session_or_question: Any, question: Question, exam: Exam) -> str:
    """Generates canonical filename stem (without extension) e.g. upsc-cse-2026-2026-gs-1-001."""
    exam_code = exam.code if exam else "EXAM_PAPER"
    year = question.source_year or 2026
    paper_str = question.section_code or "GS_1"
    return f"{exam_code.lower().replace('_', '-')}-{year}-{paper_str.lower().replace('_', '-')}-{question.question_number_in_paper:03d}"


async def async_export_question_to_yaml_dict(session: AsyncSession, question: Question) -> Dict[str, Any]:
    """Asynchronously serializes a Question SQLModel record into standard PYQ collection YAML format."""
    exam = await session.get(Exam, question.exam_id) if question.exam_id else None
    subtopic = await session.get(Subtopic, question.subtopic_id) if question.subtopic_id else None
    topic = await session.get(Topic, subtopic.topic_id) if subtopic and subtopic.topic_id else None
    subject = await session.get(Subject, topic.subject_id) if topic and topic.subject_id else None

    # Fetch Translations
    q_trans_res = await session.exec(
        select(QuestionTranslation).where(QuestionTranslation.question_id == question.id)
    )
    q_trans_list = q_trans_res.all()
    q_trans = next((t for t in q_trans_list if t.language.value == "ENGLISH"), q_trans_list[0] if q_trans_list else None)

    # Fetch Options
    options_res = await session.exec(
        select(QuestionOption).where(QuestionOption.question_id == question.id).order_by(QuestionOption.display_order)
    )
    options = options_res.all()

    formatted_options = []
    correct_answer = "A"
    for opt in options:
        opt_trans_res = await session.exec(
            select(OptionTranslation).where(OptionTranslation.option_id == opt.id)
        )
        opt_trans = opt_trans_res.first()
        formatted_options.append({
            "id": opt.option_label,
            "text": opt_trans.option_text if opt_trans else ""
        })
        if opt.is_correct:
            correct_answer = opt.option_label

    # Fetch Asset
    asset_res = await session.exec(
        select(QuestionAsset).where(QuestionAsset.question_id == question.id)
    )
    asset = asset_res.first()

    exam_code = exam.code if exam else "EXAM_PAPER"
    year = question.source_year or 2026
    paper_str = question.section_code or "GS_1"
    q_filename_stem = get_canonical_question_filename_stem(session, question, exam)

    record = {
        "id": q_filename_stem,
        "exam": {
            "code": exam_code,
            "stage": "PRELIMS",
            "paper": paper_str
        },
        "year": year,
        "language": q_trans.language.value.lower() if q_trans else "en",
        "source": {
            "type": question.source_type.value if hasattr(question.source_type, "value") else str(question.source_type),
            "reference": exam.name if exam else "Exam Paper",
            "page": json_first_page(question.page_numbers_json)
        },
        "question": q_trans.question_text if q_trans else "",
        "options": formatted_options,
        "correct_answer": correct_answer,
        "tags": {
            "subject": subject.name if subject else "General Studies",
            "topic": topic.name if topic else "General Topic",
            "sub_topic": subtopic.name if subtopic else "General Subtopic",
            "difficulty": question.difficulty.value if hasattr(question.difficulty, "value") else str(question.difficulty),
            "estimated_time_seconds": question.expected_time_seconds
        },
        "metadata": {
            "question_number": question.question_number_in_paper,
            "answer_source": "Official Answer Key",
            "review_status": question.status.value if hasattr(question.status, "value") else str(question.status)
        }
    }

    if asset:
        record["image"] = {
            "key": asset.asset_path,
            "alt_text": asset.caption or "Question Visual Asset"
        }

    return record


async def async_export_question_to_yaml_string(session: AsyncSession, question: Question) -> str:
    data = await async_export_question_to_yaml_dict(session, question)
    return yaml.dump(data, sort_keys=False, allow_unicode=True)
