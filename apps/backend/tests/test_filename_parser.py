import unittest
from app.config.filename_parser import (
    parse_question_paper_filename,
    parse_answer_key_filename,
)


class TestFilenameParser(unittest.TestCase):
    def test_valid_question_paper_filename(self):
        res = parse_question_paper_filename("upsc_cse-prelims-gs1-2023-A.pdf")
        self.assertEqual(res["exam_name"], "upsc_cse")
        self.assertEqual(res["stage"], "prelims")
        self.assertEqual(res["subject_code"], "gs1")
        self.assertEqual(res["year"], 2023)
        self.assertEqual(res["set_code"], "SET_A")
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2023-A")

    def test_invalid_question_paper_filename_raises_value_error(self):
        with self.assertRaises(ValueError):
            parse_question_paper_filename("upsc_cse_prelims_gs1.pdf")  # Missing tokens

    def test_valid_answer_key_filename(self):
        res = parse_answer_key_filename("upsc_cse-prelims-gs1-2023.pdf")
        self.assertEqual(res["exam_name"], "upsc_cse")
        self.assertEqual(res["stage"], "prelims")
        self.assertEqual(res["subject_code"], "gs1")
        self.assertEqual(res["year"], 2023)
        self.assertEqual(res["canonical_code"], "upsc_cse-prelims-gs1-2023")

    def test_invalid_answer_key_filename_raises_value_error(self):
        with self.assertRaises(ValueError):
            parse_answer_key_filename("invalid_answer_key")  # Missing tokens


if __name__ == "__main__":
    unittest.main()
