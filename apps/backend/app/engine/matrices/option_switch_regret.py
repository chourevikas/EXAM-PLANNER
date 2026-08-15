from typing import Dict, List, Any


class OptionSwitchRegretStrategy:
    @classmethod
    def evaluate_switches(cls, switch_events: List[Dict]) -> Dict[str, Any]:
        if not switch_events:
            return {
                "total_switches": 0,
                "positive_switches": 0,
                "negative_regret_switches": 0,
                "regret_index": 0.0,
                "regret_ratio": 0.0,
                "switch_frequency": 0,
                "regret_level": "INTUITIVE_PRECISION_NO_REGRET",
                "recommendation": "Trust initial instinct; zero answer switches made under pressure.",
            }

        pos_switches = 0
        neg_switches = 0

        for s in switch_events:
            init_c = s.get("initial_correct", False)
            final_c = s.get("final_correct", False)

            if not init_c and final_c:
                pos_switches += 1
            elif init_c and not final_c:
                neg_switches += 1

        total = len(switch_events)
        regret_ratio = neg_switches / total if total > 0 else 0.0

        # 5-Tier Finer Regret Boundaries
        if regret_ratio > 0.60:
            regret_level = "HIGH_PANIC_SWITCH_REGRET"
            rec = "Severe Option Switch Regret. You consistently overturn correct instincts into incorrect choices under pressure."
        elif regret_ratio > 0.40:
            regret_level = "ELEVATED_DOUBT_REGRET"
            rec = "Elevated switch regret. Do not change answers on medium-difficulty questions unless finding concrete contradictory proof."
        elif regret_ratio > 0.20:
            regret_level = "BALANCED_REVISION_OUTCOME"
            rec = "Balanced revision outcome. Your second thoughts produce equal gains and losses."
        elif total > 0 and regret_ratio > 0.0:
            regret_level = "CONSTRUCTIVE_SECOND_THOUGHTS"
            rec = "Constructive second thoughts. Most answer modifications corrected mistaken initial assumptions."
        else:
            regret_level = "INTUITIVE_PRECISION_NO_REGRET"
            rec = "Flawless revision discipline. All answer switches yielded positive point gains."

        return {
            "total_switches": total,
            "switch_frequency": total,
            "positive_switches": pos_switches,
            "negative_regret_switches": neg_switches,
            "regret_index": round(regret_ratio, 2),
            "regret_ratio": round(regret_ratio, 2),
            "regret_level": regret_level,
            "recommendation": rec,
        }
