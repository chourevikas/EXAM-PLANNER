from typing import Dict, List, Any


class OptionSwitchRegretStrategy:
    @classmethod
    def evaluate_switches(cls, switch_events: List[Dict]) -> Dict[str, Any]:
        if not switch_events:
            return {
                "total_switches": 0,
                "regret_index": 0.0,
                "recommendation": "Trust initial instinct; minimal answer switching observed."
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

        rec = "Constructive answer switching."
        if regret_ratio > 0.40:
            rec = "High Option Switch Regret! You frequently second-guess correct initial instincts under pressure."

        return {
            "total_switches": total,
            "positive_switches": pos_switches,
            "negative_regret_switches": neg_switches,
            "regret_index": round(regret_ratio, 2),
            "recommendation": rec
        }
