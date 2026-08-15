class ClosenessEvaluator:
    @staticmethod
    def classify_option(closeness_score: float) -> str:
        # 7-Tier Finer Distractor Closeness Categories
        if closeness_score >= 0.99:
            return "Correct Response"
        elif 0.65 <= closeness_score < 0.99:
            return "High-Closeness Distractor (Near-Correct)"
        elif 0.33 <= closeness_score < 0.65:
            return "Moderate Distractor (Plausible Alternative)"
        elif 0.00 <= closeness_score < 0.33:
            return "Neutral Distractor (Weak Alignment)"
        elif -0.33 <= closeness_score < 0.00:
            return "Misleading Distractor (Cognitive Trap)"
        elif -0.67 <= closeness_score < -0.33:
            return "Inverse Distractor (Inverted Logic)"
        else:
            return "Contradictory Distractor (Direct Opposing Fact)"
