import unittest
from app.config.filename_parser import (
    parse_question_paper_filename,
    parse_answer_key_filename,
)


class TestFilenameParser(unittest.TestCase):
    def test_valid_question_paper_filename(self):
        res = parse_question_paper_filename("upsc_cse-prelims-gs1-2023-A.pdf", year=2023)
        self.assertEqual(res["exam_name"], "UPSC_CSE")
        self.assertEqual(res["stage"], "PRELIMS")
        self.assertEqual(res["subject_code"], "GS1")
        self.assertEqual(res["year"], 2023)
        self.assertEqual(res["set_code"], "SET_A")
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2023-set_a")

    def test_explicit_metadata_question_paper(self):
        res = parse_question_paper_filename(
            "random_scan.pdf",
            year=2024,
            exam_name="upsc_cse",
            stage="prelims",
            subject_code="gs1",
            user_set_code="A",
        )
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2024-set_a")
        self.assertEqual(res["year"], 2024)
        self.assertEqual(res["set_code"], "SET_A")

    def test_missing_year_fallback(self):
        res_qp = parse_question_paper_filename("scan.pdf", year=None)
        self.assertIsInstance(res_qp["year"], int)

        res_ak = parse_answer_key_filename("scan.pdf", year="")
        self.assertIsInstance(res_ak["year"], int)

    def test_valid_answer_key_filename(self):
        res = parse_answer_key_filename("upsc_cse-prelims-gs1-2023.pdf", year=2023)
        self.assertEqual(res["exam_name"], "UPSC_CSE")
        self.assertEqual(res["stage"], "PRELIMS")
        self.assertEqual(res["subject_code"], "GS1")
        self.assertEqual(res["year"], 2023)
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2023-set_a")

    def test_custom_answer_key_filename(self):
        res = parse_answer_key_filename("custom_answer_key.pdf", year=2024)
        self.assertEqual(res["canonical_code"], "upsc-prelims-gs1-2024-set_a")
        self.assertEqual(res["year"], 2024)

    def test_numeric_set_codes(self):
        res_qp = parse_question_paper_filename("upsc-prelims-gs1-2022-2.pdf", year=2022, user_set_code="2")
        self.assertEqual(res_qp["set_code"], "SET_2")
        self.assertEqual(res_qp["canonical_code"], "upsc-prelims-gs1-2022-set_2")

        res_ak = parse_answer_key_filename("upsc-prelims-gs1-2022.pdf", year=2022, user_set_code="SET_4")
        self.assertEqual(res_ak["set_code"], "SET_4")
        self.assertEqual(res_ak["canonical_code"], "upsc-prelims-gs1-2022-set_4")


if __name__ == "__main__":
    unittest.main()
