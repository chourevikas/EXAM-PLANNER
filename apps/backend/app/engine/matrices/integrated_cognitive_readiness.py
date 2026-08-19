from typing import Dict, Any


class IntegratedCognitiveReadinessEngine:
    @classmethod
    def compute_icrs(
        cls,
        irt_theta: float,
        gti_value: float,
        oeei_score: float,
        pacing_skew: float,
        satoi_score: float,
    ) -> Dict[str, Any]:
        irt_component = max(0.0, min(100.0, ((irt_theta + 3.5) / 7.0) * 100.0))
        oeei_component = max(0.0, min(100.0, oeei_score * 100.0))
        gti_component = max(0.0, min(100.0, (1.0 - gti_value) * 100.0))
        stamina_component = max(0.0, min(100.0, satoi_score))
        skew_penalty = abs(1.0 - pacing_skew) * 25.0
        pacing_component = max(0.0, min(100.0, 100.0 - skew_penalty))

        icrs = (
            (0.40 * irt_component)
            + (0.25 * oeei_component)
            + (0.15 * gti_component)
            + (0.10 * stamina_component)
            + (0.10 * pacing_component)
        )
        icrs = round(icrs, 1)

        # 7-Tier Finer Diagnostic Scale
        if icrs >= 90.0:
            tier = "EXCEPTIONAL_PRELIMS_READY"
            interpretation = "Outstanding mastery. High IRT ability, flawless option elimination, and peak stamina."
        elif icrs >= 80.0:
            tier = "HIGH_COMPETENCE_READY"
            interpretation = "Comfortably above historical cutoff thresholds with robust pacing discipline."
        elif icrs >= 70.0:
            tier = "COMPETITIVE_BENCHMARK_READY"
            interpretation = "Meets competitive benchmark. Targeted revision in weak topics will secure qualification."
        elif icrs >= 55.0:
            tier = "MODERATE_DEVELOPING_READINESS"
            interpretation = "Developing readiness. Moderate risk of falling short due to unforced distractor errors."
        elif icrs >= 40.0:
            tier = "FOUNDATIONAL_VULNERABILITY"
            interpretation = "Foundational gaps detected. Needs systematic revision of high-yield core concepts."
        elif icrs >= 25.0:
            tier = "SIGNIFICANT_CONCEPTUAL_DEFICIT"
            interpretation = "Substantial conceptual confusion with high negative marking from rushed attempts."
        else:
            tier = "CRITICAL_INTERVENTION_REQUIRED"
            interpretation = "Critical intervention needed. Focus exclusively on syllabus fundamentals and reading discipline."

        return {
            "icrs_score": icrs,
            "readiness_tier": tier,
            "classification": tier,
            "interpretation": interpretation,
            "breakdown": {
                "concept_mastery_irt_pct": round(irt_component, 1),
                "tactical_elimination_pct": round(oeei_component, 1),
                "discipline_gti_pct": round(gti_component, 1),
                "cognitive_stamina_pct": round(stamina_component, 1),
                "pacing_balance_pct": round(pacing_component, 1),
            },
        }
