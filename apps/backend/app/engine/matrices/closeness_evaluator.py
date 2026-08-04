class ClosenessEvaluator:
    @staticmethod
    def classify_option(closeness_score: float) -> str:
        if closeness_score >= 0.99:
            return "Correct Response"
        elif 0.33 <= closeness_score < 0.99:
            return "High-Closeness Distractor (Partial Knowledge)"
        elif 0.00 <= closeness_score < 0.33:
            return "Neutral Distractor (Weak Alignment)"
        elif -0.50 <= closeness_score < 0.00:
            return "Misleading Distractor (Cognitive Trap)"
        else:
            return "Inverse Distractor (Inverted Logic)"
