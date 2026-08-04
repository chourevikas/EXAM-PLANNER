import unittest
from app.engine.psychometrics import (
    ClosenessEvaluator,
    GuessingTendencyStrategy,
    TimeTieredScoringStrategy,
    FSRSEngine,
    ExamMacroTimeStrategy,
    OptionEliminationStrategy,
    BloomsMasteryStrategy,
    IRT3PLStrategy,
    OptionSwitchRegretStrategy,
    SATOIEngine,
    TopicFSRSDecayEngine,
    IntegratedCognitiveReadinessEngine,
)


class TestPsychometricEngine(unittest.TestCase):
    def test_closeness_evaluator(self):
        self.assertEqual(ClosenessEvaluator.classify_option(1.0), "Correct Response")
        self.assertEqual(
            ClosenessEvaluator.classify_option(0.65),
            "High-Closeness Distractor (Partial Knowledge)",
        )
        self.assertEqual(
            ClosenessEvaluator.classify_option(0.15),
            "Neutral Distractor (Weak Alignment)",
        )
        self.assertEqual(
            ClosenessEvaluator.classify_option(-0.35),
            "Misleading Distractor (Cognitive Trap)",
        )

    def test_gti_strategy(self):
        gti_val = GuessingTendencyStrategy.compute_item_guessing(
            time_taken_sec=10.0,
            expected_time_sec=60.0,
            option_closeness=-0.40,
            is_correct=False,
        )
        self.assertGreater(gti_val, 0.50)
        interp = GuessingTendencyStrategy.interpret_gti(0.70)
        self.assertEqual(interp["category"], "IMPULSIVE_BLIND_GUESSING")

    def test_time_tiered_scoring(self):
        score_opt = TimeTieredScoringStrategy.calculate_score(
            is_correct=True,
            time_taken_sec=50.0,
            expected_time_sec=60.0,
            closeness_score=1.0,
        )
        self.assertEqual(score_opt["final_score"], 2.0)
        self.assertEqual(score_opt["time_window"], "OPTIMAL")

    def test_fsrs_engine(self):
        r = FSRSEngine.calculate_retrievability(elapsed_days=0.0, stability=2.0)
        self.assertEqual(r, 1.0)
        state = FSRSEngine.update_memory_state(
            current_difficulty=5.0, current_stability=2.0, elapsed_days=3.0, grade=3
        )
        self.assertGreater(state["fsrs_stability"], 2.0)

    def test_irt_3pl_strategy(self):
        items_data = [
            {"a": 1.5, "b": -0.5, "c": 0.25, "is_correct": True},
            {"a": 1.8, "b": 0.2, "c": 0.25, "is_correct": True},
            {"a": 1.2, "b": 1.0, "c": 0.25, "is_correct": False},
        ]
        res = IRT3PLStrategy.estimate_latent_ability(items_data)
        self.assertIn("latent_ability_theta", res)
        self.assertIn("percentile_rank", res)

    def test_satoi_engine(self):
        responses = [
            {"is_correct": True, "time_taken_seconds": 50},
            {"is_correct": True, "time_taken_seconds": 45},
            {"is_correct": False, "time_taken_seconds": 20},
            {"is_correct": False, "time_taken_seconds": 15},
        ]
        satoi = SATOIEngine.evaluate_satoi(responses)
        self.assertIn("satoi_score", satoi)
        self.assertIn("cognitive_stamina_status", satoi)

    def test_integrated_cognitive_readiness(self):
        icrs = IntegratedCognitiveReadinessEngine.compute_icrs(
            irt_theta=1.2,
            gti_value=0.15,
            oeei_score=0.85,
            pacing_skew=1.05,
            satoi_score=90.0,
        )
        self.assertGreater(icrs["icrs_score"], 70.0)
        self.assertEqual(icrs["readiness_tier"], "COMPETITIVE_BENCHMARK_READY")


if __name__ == "__main__":
    unittest.main()
