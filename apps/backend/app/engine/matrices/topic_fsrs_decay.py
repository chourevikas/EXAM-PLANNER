from typing import Dict, List, Any
from app.engine.matrices.fsrs_retention import FSRSEngine


class TopicFSRSDecayEngine:
    @classmethod
    def evaluate_topic_decay(
        cls, topic_memory_records: List[Dict]
    ) -> List[Dict[str, Any]]:
        summary = []
        for rec in topic_memory_records:
            topic = rec.get("topic_name", "General")
            stability = rec.get("stability", 1.0)
            elapsed = rec.get("last_reviewed_days_ago", 0.0)

            r = FSRSEngine.calculate_retrievability(elapsed, stability)
            r_pct = round(r * 100, 1)

            health = "HEALTHY_RETENTION"
            if r_pct < 60.0:
                health = "IMMINENT_FORGETTING_RISK"
            elif r_pct < 80.0:
                health = "REVISION_DUE_SOON"

            summary.append(
                {
                    "topic_name": topic,
                    "fsrs_stability": round(stability, 2),
                    "current_retrievability_pct": r_pct,
                    "retention_health": health,
                }
            )

        return summary
