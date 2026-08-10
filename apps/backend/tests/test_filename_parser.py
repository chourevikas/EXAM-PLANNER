import unittest
from app.config.filename_parser import (
    parse_question_paper_filename,
    parse_answer_key_filename,
)


class TestFilenameParser(unittest.TestCase):
    def test_valid_question_paper_filename(self):
        res = parse_question_paper_filename("upsc_cse-prelims-gs1-2023-A.pdf")
        self.assertEqual(res["exam_name"], "UPSC_CSE")
        self.assertEqual(res["stage"], "PRELIMS")
        self.assertEqual(res["subject_code"], "GS1")
        self.assertEqual(res["year"], 2023)
        self.assertEqual(res["set_code"], "SET_A")
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2023")

    def test_explicit_metadata_question_paper(self):
        res = parse_question_paper_filename("random_scan.pdf", exam_name="upsc_cse", stage="prelims", subject_code="gs1", year=2024, user_set_code="A")
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2024")
        self.assertEqual(res["set_code"], "SET_A")

    def test_custom_question_paper_filename_fallback(self):
        res = parse_question_paper_filename("upsc_cse_prelims_gs1.pdf")
        self.assertEqual(res["canonical_code"], "upsc-cse-prelims-gs1")
        self.assertEqual(res["set_code"], "SET_A")

    def test_valid_answer_key_filename(self):
        res = parse_answer_key_filename("upsc_cse-prelims-gs1-2023.pdf")
        self.assertEqual(res["exam_name"], "UPSC_CSE")
        self.assertEqual(res["stage"], "PRELIMS")
        self.assertEqual(res["subject_code"], "GS1")
        self.assertEqual(res["year"], 2023)
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2023")

    def test_custom_answer_key_filename_fallback(self):
        res = parse_answer_key_filename("custom_answer_key.pdf")
        self.assertEqual(res["canonical_code"], "custom")


if __name__ == "__main__":
    unittest.main()
