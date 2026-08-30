import asyncio
import uuid
import logging
from sqlmodel import select
from app.db.session import async_session_factory
from app.db.models import SyllabusVersion, Subject, Topic, Subtopic, Exam
from app.schemas.syllabus_literals import SYLLABUS_HIERARCHY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SyllabusSync")

async def sync_master_syllabus():
    logger.info("🔄 Starting Master Syllabus Hierarchy DB Sync...")
    async with async_session_factory() as session:
        # Get first exam
        exam = (await session.exec(select(Exam))).first()
        if not exam:
            logger.warning("No exams found in DB.")
            return

        # 1. Get or create Default SyllabusVersion
        stmt_syl = select(SyllabusVersion).where(SyllabusVersion.exam_id == exam.id)
        syl_ver = (await session.exec(stmt_syl)).first()
        if not syl_ver:
            syl_ver = SyllabusVersion(
                id=uuid.uuid4(),
                exam_id=exam.id,
                title="UPSC Prelims Master Syllabus (GS Micro-Topics)",
                version_code="UPSC_PRELIMS_MASTER_V1",
            )
            session.add(syl_ver)
            await session.commit()
            await session.refresh(syl_ver)

        existing_subjects = {s.name.strip().lower(): s for s in (await session.exec(select(Subject))).all()}
        existing_topics = {t.name.strip().lower(): t for t in (await session.exec(select(Topic))).all()}
        existing_subtopics = {st.name.strip().lower(): st for st in (await session.exec(select(Subtopic))).all()}

        added_subjects = 0
        added_topics = 0
        added_subtopics = 0

        for subject_name, topics_dict in SYLLABUS_HIERARCHY.items():
            s_key = subject_name.strip().lower()
            subject = existing_subjects.get(s_key)
            if not subject:
                subject = Subject(
                    version_id=syl_ver.id,
                    name=subject_name.strip(),
                    code=subject_name.strip()[:4].upper(),
                    display_order=len(existing_subjects) + 1,
                )
                session.add(subject)
                await session.flush()
                existing_subjects[s_key] = subject
                added_subjects += 1

            for topic_name, subtopics_list in topics_dict.items():
                t_key = topic_name.strip().lower()
                topic = existing_topics.get(t_key)
                if not topic:
                    topic = Topic(
                        subject_id=subject.id,
                        name=topic_name.strip(),
                        display_order=len(existing_topics) + 1,
                    )
                    session.add(topic)
                    await session.flush()
                    existing_topics[t_key] = topic
                    added_topics += 1
                elif topic.subject_id is None:
                    topic.subject_id = subject.id
                    session.add(topic)

                for subtopic_name in subtopics_list:
                    st_key = subtopic_name.strip().lower()
                    subtopic = existing_subtopics.get(st_key)
                    if not subtopic:
                        subtopic = Subtopic(
                            topic_id=topic.id,
                            name=subtopic_name.strip(),
                            pyq_frequency=1,
                        )
                        session.add(subtopic)
                        existing_subtopics[st_key] = subtopic
                        added_subtopics += 1
                    elif subtopic.topic_id is None:
                        subtopic.topic_id = topic.id
                        session.add(subtopic)

        await session.commit()
        logger.info(
            f"🎉 Master Syllabus Sync Complete! Added {added_subjects} subjects, "
            f"{added_topics} topics, {added_subtopics} subtopics. "
            f"Total mapped: {len(existing_subjects)} Subjects, {len(existing_topics)} Topics, {len(existing_subtopics)} Subtopics."
        )

if __name__ == "__main__":
    asyncio.run(sync_master_syllabus())
