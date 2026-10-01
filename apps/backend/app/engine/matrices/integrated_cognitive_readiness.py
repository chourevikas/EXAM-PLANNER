from typing import Dict, Any


class IntegratedCognitiveReadinessEngine:
    @staticmethod
    def classify_tier(icrs: float) -> tuple[str, str, str]:
        """Direct, clear UPSC Prelims preparedness scale shared by exam-wise and cumulative reports."""
        if icrs >= 85.0:
            return (
                "EXCEPTIONAL_PRELIMS_READY",
                "Prelims Ready - Top Rank Contender",
                "Outstanding mastery. Consistently clearing historical UPSC cutoffs with high elimination discipline.",
            )
        if icrs >= 70.0:
            return (
                "COMPETITIVE_BENCHMARK_READY",
                "Prelims Ready Benchmark",
                "Comfortably within competitive qualification range. Targeted revision in weak topics will secure your seat.",
            )
        if icrs >= 50.0:
            return (
                "MODERATE_DEVELOPING_READINESS",
                "Developing Readiness - Target Revision Needed",
                "Moderate readiness. Solid foundation, but unforced errors and negative marking are holding back the qualifying score.",
            )
        if icrs >= 30.0:
            return (
                "FOUNDATIONAL_VULNERABILITY",
                "Foundation Building Needed",
                "Foundational gaps detected. Low syllabus coverage or excessive negative penalties require focused chapter revisions.",
            )
        return (
            "CRITICAL_INTERVENTION_REQUIRED",
            "Critical Foundation & Practice Required",
            "Very low attempt coverage or conceptual gaps. Complete the full syllabus and practice 15-20 questions daily.",
        )

    @classmethod
    def compute_icrs(
        cls,
        irt_theta: float,
        gti_value: float,
        oeei_score: float,
        pacing_skew: float,
        satoi_score: float,
        net_score: float = None,
        max_score: float = 200.0,
        attempted_count: int = None,
        total_questions: int = 100,
        qualifying_cutoff: float = 92.0,
    ) -> Dict[str, Any]:
        # 1. Base Cognitive Components (0 - 100)
        irt_component = max(0.0, min(100.0, ((irt_theta + 3.5) / 7.0) * 100.0))
        oeei_component = max(0.0, min(100.0, oeei_score * 100.0))
        gti_component = max(0.0, min(100.0, (1.0 - gti_value) * 100.0))
        stamina_component = max(0.0, min(100.0, satoi_score))
        skew_penalty = abs(1.0 - pacing_skew) * 25.0
        pacing_component = max(0.0, min(100.0, 100.0 - skew_penalty))

        raw_composite = (
            (0.35 * irt_component)
            + (0.25 * oeei_component)
            + (0.15 * gti_component)
            + (0.15 * stamina_component)
            + (0.10 * pacing_component)
        )

        # 2. Grounding against Exam Benchmark Cutoff & Coverage if provided
        if net_score is None and attempted_count is None:
            coverage_factor = 1.0
            icrs = round(raw_composite, 1)
        else:
            tot_q = max(1, total_questions or 100)
            att_cnt = max(0, min(tot_q, attempted_count or 0))
            coverage_ratio = att_cnt / float(tot_q)
            
            cutoff_target = max(1.0, qualifying_cutoff or 92.0)
            cutoff_ratio = max(0.0, min(1.2, float(net_score or 0.0) / cutoff_target))

            coverage_factor = 0.20 + (0.80 * (0.60 * cutoff_ratio + 0.40 * coverage_ratio))
            coverage_factor = max(0.12, min(1.0, coverage_factor))
            icrs = round(raw_composite * coverage_factor, 1)

        tier, tier_label, interpretation = cls.classify_tier(icrs)

        return {
            "icrs_score": icrs,
            "readiness_tier": tier,
            "readiness_label": tier_label,
            "classification": tier_label,
            "interpretation": interpretation,
            "breakdown": {
                "concept_mastery_irt_pct": round(irt_component, 1),
                "tactical_elimination_pct": round(oeei_component, 1),
                "discipline_gti_pct": round(gti_component, 1),
                "cognitive_stamina_pct": round(stamina_component, 1),
                "pacing_balance_pct": round(pacing_component, 1),
            },
        }
