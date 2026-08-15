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

            # 5-Tier Finer Memory Decay Boundaries
            if r_pct >= 90.0:
                health = "OPTIMAL_LONG_TERM_STABILITY"
            elif r_pct >= 75.0:
                health = "HEALTHY_ACTIVE_RETENTION"
            elif r_pct >= 60.0:
                health = "REVISION_RECOMMENDED_SOON"
            elif r_pct >= 45.0:
                health = "ACCELERATED_FORGETTING_RISK"
            else:
                health = "CRITICAL_MEMORY_DECAY"

            summary.append(
                {
                    "topic_name": topic,
                    "fsrs_stability": round(stability, 2),
                    "current_retrievability_pct": r_pct,
                    "retention_health": health,
                }
            )

        return summary
