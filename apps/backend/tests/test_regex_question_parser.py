import pytest
from app.pipeline.regex_question_parser import (
    detect_format,
    split_into_question_blocks,
    parse_question_block,
    QuestionRecord,
)
from app.db.models.enums import DifficultyLevel

SAMPLE_USER_TEXT = """
UPSC Civil Services Examination (Prelims) 2021  General Studies Paper I - All 100 Questions with Answers, Explanations & Extended Topic Notes  

Q1. [Subject: History & Culture] [Topic: Ancient Indian Literature & Art] [Sub-topic: Sanskrit Dramatists & Classical Poets] [Difficulty: Tough]  
With reference to the history of ancient India, Bhavabhuti, Hastimalla and Kshemeshvara were famous  
(A) Jain monks  
(B) playwrights  
(C) temple architects  
(D) philosophers  
Answer: (B) playwrights  
Solution:Bhavabhuti was an 8th-century Indian dramatist, poet and scholar who wrote Mahaviracharita, Malatimadhava and Uttararamacharita. Hastimalla was a Jain poet-playwright in the Solanki court (author of Purvapurana), and Kshemeshvara was court poet of Mahipala of Kannauj (author of Dasavatar Charita). All three were playwrights.  
Bhavabhuti's Uttararamacharita depicts Rama's coronation, Sita's abandonment and their reunion.  
Sanskrit drama also includes Kalidasa (Abhijnanashakuntalam).  
Common Mistake: Students confuse Hastimalla (Jain poet-playwright) with a Jain 'monk' he was a court poet, not a monastic monk.  
Reverse Logic Box Why the other options are wrong  
Option (A): Why it seems tempting - Sounds plausible since Hastimalla worked in a royal court and Jainism is often linked with monastic figures. What's actually true - Hastimalla was a Jain poet-playwright (author of Purvapurana), not a renunciate monk - his role was literary, not monastic.  
Option (C): Why it seems tempting - Temple architecture flourished in medieval India under Cholas and Chandellas, so candidates might guess these are architects. What's actually true - Temple architects include figures like Ramappa (Kakatiya) or Somnath, not Bhavabhuti or Kshemeshvara.  
Option (D): Why it seems tempting - Ancient Indian philosophy is prominent in UPSC, and names sound classical. What's actually true - Classical philosophers include Shankara, Ramanuja, Madhva, Nagarjuna; Bhavabhuti and Kshemeshvara wrote dramatic plays, not philosophical treatises.
"""


def test_format_detector():
    """Verify that sample text is detected as EXPLAINED_QA and standard text as RAW_EXAM."""
    assert detect_format(SAMPLE_USER_TEXT) == "EXPLAINED_QA"
    assert detect_format("1. What is the capital of France?\n(A) Paris\n(B) London\n") == "RAW_EXAM"


def test_split_into_question_blocks():
    """Verify that text is split into distinct question blocks."""
    blocks = split_into_question_blocks(SAMPLE_USER_TEXT)
    assert len(blocks) == 1
    assert blocks[0]["question_number"] == 1
    assert "Bhavabhuti" in blocks[0]["raw_text"]


def test_golden_file_parsing():
    """Verify that all fields are extracted accurately from the user's golden sample text."""
    blocks = split_into_question_blocks(SAMPLE_USER_TEXT)
    assert len(blocks) == 1

    record: QuestionRecord = parse_question_block(blocks[0])

    assert record.question_number == 1
    assert record.subject_raw == "History & Culture"
    assert record.topic_raw == "Ancient Indian Literature & Art"
    assert record.subtopic_raw == "Sanskrit Dramatists & Classical Poets"
    assert record.difficulty_raw == "Tough"
    assert record.difficulty == DifficultyLevel.HARD

    # Stem
    assert "With reference to the history of ancient India" in record.stem
    assert "Bhavabhuti, Hastimalla and Kshemeshvara" in record.stem

    # Options
    assert len(record.options) == 4
    assert record.options["A"] == "Jain monks"
    assert record.options["B"] == "playwrights"
    assert record.options["C"] == "temple architects"
    assert record.options["D"] == "philosophers"

    # Answer
    assert record.answer_label == "B"
    assert record.answer_text == "playwrights"

    # Solution
    assert "8th-century Indian dramatist" in record.solution_text

    # Common Mistake
    assert record.common_mistake is not None
    assert "Students confuse Hastimalla" in record.common_mistake

    # Reverse Logic Box
    assert len(record.reverse_logic) == 3
    assert "A" in record.reverse_logic
    assert "Sounds plausible since Hastimalla worked" in record.reverse_logic["A"]["why_tempting"]
    assert "Hastimalla was a Jain poet-playwright" in record.reverse_logic["A"]["whats_actually_true"]

    assert "C" in record.reverse_logic
    assert "D" in record.reverse_logic

    # Confidence and Validation
    assert record.extraction_confidence == 1.0
    assert len(record.extraction_issues) == 0


def test_ocr_noise_fuzzing():
    """Verify that parser handles OCR noise: lowercase labels, varied spacing, dashes, and bullets."""
    noisy_text = """
    Q2. [subject : Polity & Governance] [Topic: Constitutional Bodies] [Difficulty : Medium]
    Consider the following statements regarding the Finance Commission:
    1. It is a quasi-judicial body constituted under Article 280.
    2. Its recommendations are legally binding on the Government.
    Which of the statements given above is/are correct?
    (a) 1 only
    (b) 2 only
    (c) Both 1 and 2
    (d) Neither 1 nor 2
    ans: (A) 1 only
    Solution:
    The Finance Commission is constituted by the President under Article 280 of the Constitution.
    Its recommendations are only advisory in nature and not binding.
    Common mistake: Many aspirants assume commission recommendations are binding.
    Reverse Logic Box:
    Option (B): *Why it seems tempting* - Constitutional bodies often carry authority. *What's actually true* - Recommendations are advisory only.
    Option (C): *Why it seems tempting* - Statement 1 is correct so candidates pick both. *What's actually true* - Statement 2 is incorrect.
    Option (D): *Why it seems tempting* - Candidates doubt statement 1. *What's actually true* - Statement 1 is directly from Art 280.
    """
    blocks = split_into_question_blocks(noisy_text)
    assert len(blocks) == 1
    record = parse_question_block(blocks[0])

    assert record.question_number == 2
    assert record.subject_raw == "Polity & Governance"
    assert record.topic_raw == "Constitutional Bodies"
    assert record.difficulty_raw == "Medium"
    assert record.difficulty == DifficultyLevel.MEDIUM

    assert "Consider the following statements" in record.stem
    assert len(record.statement_lines) == 2
    assert "quasi-judicial body" in record.statement_lines[0]

    assert len(record.options) == 4
    assert record.options["A"] == "1 only"
    assert record.options["B"] == "2 only"
    assert record.answer_label == "A"
    assert record.common_mistake is not None
    assert len(record.reverse_logic) == 3
    assert record.extraction_confidence == 1.0


def test_cross_page_splitting():
    """Verify that multi-page questions with <!-- PAGE_BREAK p=N --> are preserved."""
    multi_page_text = """
    Q3. [Subject: Environment & Ecology] [Difficulty: Easy]
    Which one of the following is a bio-fertilizer?
    (A) Rhizobium
    (B) Urea
    (C) DDT
    (D) 2,4-D
    Answer: (A)
    Solution:
    <!-- PAGE_BREAK p=2 -->
    Rhizobium is a symbiotic nitrogen-fixing bacterium that lives in root nodules of legumes.
    It serves as an important bio-fertilizer.
    Reverse Logic Box
    Option (B): Why it seems tempting - Common nitrogen fertilizer. What's actually true - Urea is a synthetic chemical fertilizer.
    Option (C): Why it seems tempting - Chemical name. What's actually true - DDT is an insecticide.
    Option (D): Why it seems tempting - Widely used. What's actually true - 2,4-D is a weedicide.
    """
    blocks = split_into_question_blocks(multi_page_text)
    assert len(blocks) == 1
    record = parse_question_block(blocks[0])
    assert record.question_number == 3
    assert record.subject_raw == "Environment & Ecology"
    assert record.difficulty == DifficultyLevel.EASY
    assert "Rhizobium" in record.solution_text
    assert record.page_numbers == [1, 2]


def test_missing_section_tolerance():
    """Verify that questions missing common mistakes or reverse logic box still parse gracefully."""
    minimal_text = """
    Q4. [Subject: Geography] [Difficulty: Moderate]
    The term 'Levant' often heard in the news roughly corresponds to:
    (A) Region along the eastern Mediterranean shores
    (B) Region along North African shores
    (C) Persian Gulf region
    (D) Red Sea coastal area
    Answer: (A) Region along the eastern Mediterranean shores
    Solution: The Levant historically refers to the region along the eastern coast of the Mediterranean Sea.
    """
    blocks = split_into_question_blocks(minimal_text)
    assert len(blocks) == 1
    record = parse_question_block(blocks[0])

    assert record.question_number == 4
    assert record.subject_raw == "Geography"
    assert record.difficulty == DifficultyLevel.MEDIUM
    assert record.answer_label == "A"
    assert record.common_mistake is None
    assert len(record.reverse_logic) == 0
    assert record.extraction_confidence == 1.0
