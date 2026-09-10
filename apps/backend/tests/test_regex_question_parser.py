from app.db.models.enums import DifficultyLevel
from app.pipeline.regex_question_parser import (
    QuestionRecord,
    detect_format,
    parse_question_block,
    split_into_question_blocks,
)

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


PDF_EXAM_TEXT = """
UPSC Civil Services Examination (Prelims) 2025

Q1. [Subject: Ancient History] [Microtheme: Ancient TechXAgriculture] [Nano Theme: Araghatta — ancient irrigation device] [Difficulty: Moderate]
The irrigation device called 'Araghatta' was
(A) a water bag made of leather pulled over a pulley
(B) a large wheel with earthen pots tied to the outer ends of its spokes
(C) a larger earthen pot driven by bullocks
(D) a large water bucket pulled up by rope directly by hand
Answer: (B) a large wheel with earthen pots tied to the outer ends of its spokes
Solution:
• 'Araghatta' (also called 'Ghanti-Yantra') was specifically a large water-lifting WHEEL with several earthen pots attached to its rim/spokes — as the wheel rotated, the pots dipped into the water source and lifted water to the fields — not a leather pulley-bag, a bullock-driven pot, or a simple hand-pulled bucket.
• This ancient irrigation technology represents an early example of mechanized water-lifting, using rotational motion to automate what would otherwise require continuous manual effort.
• The 'Ghanti-Yantra' alternate name (bell-machine) likely references the sound produced by the rotating pots/mechanism during operation.
• Understanding these specific ancient irrigation-device names and mechanisms is a recurring detail-precision ancient-history/technology question category.

■ Reverse Logic Box — Why the other options are wrong
Option (A): Why it seems tempting — Tempting because a leather-bag-pulley system sounds like a plausible simple ancient water-lifting mechanism. What's actually true — Araghatta is specifically documented as a wheel-with-pots mechanism, not a leather-bag-pulley device.
Option (C): Why it seems tempting — Tempting since a bullock-driven pot sounds like a plausible animal-powered irrigation device given ancient agriculture's bullock-reliance. What's actually true — Araghatta's actual mechanism is a rotating wheel with attached pots, not a single bullock-driven pot.
Option (D): Why it seems tempting — Tempting because manual rope-pulled buckets represent a simple, plausible basic irrigation method. What's actually true — Araghatta specifically involves a mechanized rotating wheel, not simple direct hand-pulled bucket retrieval.

Q2. [Subject: Ancient History] [Microtheme: KingdomXPallava] [Nano Theme: Pallava ruler titles — Mahendravarman I] [Difficulty: Tough]
Who among the following rulers in ancient India had assumed the titles 'Mattavilasa', 'Vichitrachitta', 'Gunabhara'?
(A) Mahendravarman I
(B) Simhavishnu
(C) Narasimhavarman I
(D) Simhavarman
Answer: (A) Mahendravarman I
Solution:
• MAHENDRAVARMAN I, a 7th-century Pallava king and noted patron of art/literature, specifically assumed these titles — Mattavilasa ('delight of the intoxicated', referencing his satirical play Mattavilasa Prahasana), Vichitrachitta ('curious-minded', per the Mandagappattu inscription for his rock-cut temple), and Gunabhara ('full of virtues') — not Simhavishnu, Narasimhavarman I, or Simhavarman.
"""


def test_microtheme_and_nano_theme_parsing():
    """Verify that Microtheme is mapped to topic_raw and Nano Theme is mapped to subtopic_raw."""
    blocks = split_into_question_blocks(PDF_EXAM_TEXT)
    assert len(blocks) == 2

    # Q1 verification
    q1 = parse_question_block(blocks[0])
    assert q1.question_number == 1
    assert q1.subject_raw == "Ancient History"
    assert q1.topic_raw == "Ancient TechXAgriculture"
    assert q1.subtopic_raw == "Araghatta — ancient irrigation device"
    assert q1.difficulty_raw == "Moderate"
    assert q1.difficulty == DifficultyLevel.MEDIUM
    assert "The irrigation device called 'Araghatta' was" in q1.stem
    assert len(q1.options) == 4
    assert q1.options["B"] == "a large wheel with earthen pots tied to the outer ends of its spokes"
    assert q1.answer_label == "B"
    assert len(q1.solution_bullets) >= 4
    assert len(q1.reverse_logic) == 3
    assert "A" in q1.reverse_logic
    assert "C" in q1.reverse_logic
    assert "D" in q1.reverse_logic

    # Q2 verification
    q2 = parse_question_block(blocks[1])
    assert q2.question_number == 2
    assert q2.subject_raw == "Ancient History"
    assert q2.topic_raw == "KingdomXPallava"
    assert q2.subtopic_raw == "Pallava ruler titles — Mahendravarman I"
    assert q2.difficulty_raw == "Tough"
    assert q2.difficulty == DifficultyLevel.HARD
    assert "Who among the following rulers in ancient India" in q2.stem
    assert len(q2.options) == 4
    assert q2.options["A"] == "Mahendravarman I"
    assert q2.answer_label == "A"
    assert "MAHENDRAVARMAN I" in q2.solution_text


def test_theme_tag_variations():
    """Verify variations of Microtheme and Nano Theme tag naming and formatting."""
    from app.pipeline.patterns import extract_header_tags

    # Hyphenated, spaced, and lowercase variations
    t1 = extract_header_tags("[Subject: History] [micro-theme: Indus Valley] [nano-theme: Town Planning] [Difficulty: Easy]")
    assert t1["subject_raw"] == "History"
    assert t1["topic_raw"] == "Indus Valley"
    assert t1["subtopic_raw"] == "Town Planning"
    assert t1["difficulty_raw"] == "Easy"

    t2 = extract_header_tags("[Subject: Geography] [Micro theme: Climatology] [Nano theme: Cyclones] [Difficulty: Hard]")
    assert t2["subject_raw"] == "Geography"
    assert t2["topic_raw"] == "Climatology"
    assert t2["subtopic_raw"] == "Cyclones"
    assert t2["difficulty_raw"] == "Hard"

    t3 = extract_header_tags("[Subject: Science] [Topic: Biology] [Nanotheme: Genetics] [Difficulty: Moderate]")
    assert t3["subject_raw"] == "Science"
    assert t3["topic_raw"] == "Biology"
    assert t3["subtopic_raw"] == "Genetics"
    assert t3["difficulty_raw"] == "Moderate"
