from typing import Dict, Any


class IntegratedCognitiveReadinessEngine:
    @classmethod
    def compute_icrs(
        cls, 
        irt_theta: float, 
        gti_value: float, 
        oeei_score: float, 
        pacing_skew: float,
        satoi_score: float
    ) -> Dict[str, Any]:
        irt_component = max(0.0, min(100.0, ((irt_theta + 3.5) / 7.0) * 100.0))
        oeei_component = max(0.0, min(100.0, oeei_score * 100.0))
        gti_component = max(0.0, min(100.0, (1.0 - gti_value) * 100.0))
        stamina_component = max(0.0, min(100.0, satoi_score))
        skew_penalty = abs(1.0 - pacing_skew) * 25.0
        pacing_component = max(0.0, min(100.0, 100.0 - skew_penalty))

        icrs = (
            (0.40 * irt_component) +
            (0.25 * oeei_component) +
            (0.15 * gti_component) +
            (0.10 * stamina_component) +
            (0.10 * pacing_component)
        )
        icrs = round(icrs, 1)

        tier = "COMPETITIVE_BENCHMARK_READY"
        if icrs < 50.0:
            tier = "NEEDS_INTENSIVE_FOUNDATION"
        elif icrs < 70.0:
            tier = "MODERATE_PREPARATION"

        return {
            "icrs_score": icrs,
            "readiness_tier": tier,
            "breakdown": {
                "concept_mastery_irt_pct": round(irt_component, 1),
                "tactical_elimination_pct": round(oeei_component, 1),
                "discipline_gti_pct": round(gti_component, 1),
                "cognitive_stamina_pct": round(stamina_component, 1),
                "pacing_balance_pct": round(pacing_component, 1)
            }
        }
