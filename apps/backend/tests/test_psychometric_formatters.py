import unittest
from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
from app.formatters.report_json_formatter import format_report_to_json
from app.formatters.report_yaml_formatter import format_report_to_yaml
from app.formatters.report_markdown_formatter import format_report_to_markdown


class TestPsychometricFormatters(unittest.TestCase):
    def setUp(self):
        self.sample_report = {
            "metadata": {
                "report_title": "Comprehensive Psychometric Diagnostic Audit Report",
                "candidate": {
                    "full_name": "Aarav Sharma",
                    "email": "student@examplatform.com",
                },
                "exam_attempt": {
                    "exam_name": "UPSC_CSE Prelims (2023) - Set A",
                    "canonical_code": "upsc_cse-prelims-gs1-2023-A",
                    "total_score_awarded": 28.47,
                    "max_possible_score": 68.0,
                    "time_spent_seconds": 2100.0,
                    "total_questions_attempted": 34,
                    "attempt_date": "2026-08-02T23:00:00",
                },
            },
            "user_overall_skill_profile": {
                "description": "Aggregated long-term cognitive benchmark",
                "cumulative_icrs_score": 76.5,
                "cumulative_irt_theta": 0.85,
                "cumulative_gti": 0.12,
                "cumulative_oeei": 0.78,
                "cumulative_satoi": 90.0,
                "total_tests_given": 3,
                "total_questions_answered": 100,
                "taxonomy_mastery_breakdown": [
                    {
                        "taxonomy_type": "SUBJECT",
                        "code": "POLITY",
                        "name": "Indian Polity & Constitution",
                        "total_attempts": 30,
                        "correct_attempts": 24,
                        "mastery_percentage": 80.0,
                        "strength_status": "STRONG",
                    }
                ],
            },
            "exam_macro_analytics": {
                "1_integrated_cognitive_readiness": {
                    "meaningful_name": "Integrated Cognitive Readiness Index (ICRS)",
                    "description": "Unified 100-point benchmark",
                    "value": {
                        "icrs_score": 76.5,
                        "readiness_tier": "COMPETITIVE_BENCHMARK_READY",
                    },
                }
            },
            "per_question_diagnostic_report": [
                {
                    "question_number": 1,
                    "meaningful_name": "Question #1 - Indian Polity (Preamble)",
                    "subject_name": "Indian Polity",
                    "topic_name": "Indian Polity & Constitution",
                    "subtopic_name": "Preamble Core Concepts",
                    "user_selected_option": "A",
                    "is_answer_correct": True,
                    "closeness_classification": "Correct Response",
                    "time_taken_seconds": 45.0,
                    "time_pacing_window": "OPTIMAL",
                    "final_points_awarded": 2.0,
                    "item_guessing_probability_gti": 0.05,
                    "is_option_switched": False,
                }
            ],
        }

    def test_json_formatter(self):
        json_output = format_report_to_json(self.sample_report)
        self.assertIn("Aarav Sharma", json_output)
        self.assertIn("per_question_diagnostic_report", json_output)

    def test_yaml_formatter(self):
        yaml_output = format_report_to_yaml(self.sample_report)
        self.assertIn("Aarav Sharma", yaml_output)
        self.assertIn("cumulative_icrs_score", yaml_output)

    def test_markdown_formatter(self):
        md_output = format_report_to_markdown(self.sample_report)
        self.assertIn(
            "# 📊 Comprehensive Psychometric Diagnostic Audit Report", md_output
        )
        self.assertIn("Aarav Sharma", md_output)
        self.assertIn("Question #1 - Indian Polity (Preamble)", md_output)


if __name__ == "__main__":
    unittest.main()
