# National Benchmarking & Monthly Performance Feature Specification

## 1. Overview & Objective
The **Monthly Performance & National Rank** feature (located at `/monthly-report` / `MonthlyReportPage.tsx`) provides students with a real-time, data-driven assessment of their exam standing relative to all active UPSC CSE aspirants.

Currently, key metric cards in `MonthlyReportPage.tsx` contain hardcoded mockup data:
- **Predicted All India Rank (AIR)**: `#482` (*Top 2% among 24,000+ active aspirants*)
- **Overall Percentile**: `98.2 %ile` (*Up from 94.1 %ile last month*)
- **Exam Readiness Index**: `84 / 100` (*High probability of clearing Prelims cutoff*)

The goal of this specification is to establish the backend calculation engine, API data structures, and frontend dynamic integration strategy to replace all hardcoded values with live, candidate-specific metrics.

---

## 2. Feature Components & Requirements

### A. Key Metric Widgets

| Metric Widget | Displayed Value | Subtext / Indicator | Backend Source / Formula |
|---|---|---|---|
| **Predicted All India Rank** | `#<predicted_rank>` | `↑ Top <top_percentage>% among <active_aspirants> active aspirants` | Piecewise interpolation on candidate's Weighted Moving Average (WMA) mock test scores |
| **Overall Percentile** | `<overall_percentile> %ile` | `Up from <prev_month_percentile> %ile last month` (or `%ile delta`) | Relative position score derived from score distribution curve |
| **Exam Readiness Index** | `<readiness_index> / 100` | `<cutoff_probability_text>` | Composite score: 35% Accuracy + 25% Test Volume + 20% Syllabus Coverage + 20% Cognitive ICRS |

### B. Historical Trend & Growth Curve
- **Percentile Growth Curve**: Monthly timeline tracking user's percentile progression across past months (e.g., May, June, July, August 2026).
- **Subject-Wise Readiness Breakdown**: Benchmarks accuracy and mastery across core GS subjects (Polity, History, Economy, Geography, Environment, Sci & Tech, CSAT).

---

## 3. Backend Architecture & Calculations

### A. API Endpoint
- **URL**: `GET /api/v1/analytics/monthly-benchmark`
- **Authentication**: Bearer JWT (Student)
- **Response Schema**:
```json
{
  "exam_code": "UPSC_CSE_PRELIMS",
  "period": "August 2026",
  "predicted_rank": 482,
  "top_percentage": 2.0,
  "active_aspirants": 24850,
  "overall_percentile": 98.2,
  "previous_month_percentile": 94.1,
  "percentile_delta": 4.1,
  "readiness_index": 84,
  "readiness_status": "High probability of clearing Prelims cutoff",
  "confidence_level": "HIGH",
  "attempts_analyzed": 8,
  "monthly_growth_curve": [
    { "month": "May 2026", "percentile": 88.5, "readiness_index": 70 },
    { "month": "Jun 2026", "percentile": 91.2, "readiness_index": 76 },
    { "month": "Jul 2026", "percentile": 94.1, "readiness_index": 80 },
    { "month": "Aug 2026", "percentile": 98.2, "readiness_index": 84 }
  ],
  "subject_benchmark": [
    { "subject": "Polity", "user_accuracy": 82, "national_avg_accuracy": 65 },
    { "subject": "Economy", "user_accuracy": 78, "national_avg_accuracy": 60 },
    { "subject": "History", "user_accuracy": 71, "national_avg_accuracy": 58 }
  ]
}
```

### B. Mathematical Formulations

1. **Weighted Moving Average (WMA) Score**:
   $$\text{WMA Score} = \frac{\sum_{i=1}^{n} (S_i \times i)}{\sum_{i=1}^{n} i}$$
   *Where $S_i$ is the normalized score out of 200 for the $i$-th attempt in chronological order.*

2. **Percentile Mapping (UPSC GS Paper 1 Curve)**:
   - Score $\le 60.0 \rightarrow \text{Percentile} \in [0.0, 40.0]$
   - Score $60.0 - 80.0 \rightarrow \text{Percentile} \in [40.0, 75.0]$
   - Score $80.0 - 95.0 \rightarrow \text{Percentile} \in [75.0, 95.0]$
   - Score $95.0 - 110.0 \rightarrow \text{Percentile} \in [95.0, 99.0]$
   - Score $> 110.0 \rightarrow \text{Percentile} \in [99.0, 99.99]$

3. **Exam Readiness Index (0–100)**:
   $$\text{Readiness Index} = (0.35 \times \text{Accuracy}) + (0.25 \times \text{VolumeScore}) + (0.20 \times \text{Coverage}) + (0.20 \times \text{ICRS})$$

4. **Cutoff Probability Status**:
   - $\text{Index} \ge 80$: `"High probability of clearing Prelims cutoff"`
   - $65 \le \text{Index} < 80$: `"Moderate probability - Focus on weak subtopics"`
   - $\text{Index} < 65$: `"Revision required - Below projected Prelims cutoff threshold"`

---

## 4. Frontend Integration Plan

1. **Service Layer** (`apps/frontend/src/services/analyticsService.ts`):
   - Add `getMonthlyBenchmark()` function to fetch data from `/api/v1/analytics/monthly-benchmark` (with fallback to `/api/v1/analytics/predicted-rank`).
2. **Component Integration** (`MonthlyReportPage.tsx`):
   - Replace static numbers with React state (`benchmarkData`, `isLoading`, `error`).
   - Add loading skeleton components while data is being computed.
   - Render dynamic percentile growth chart and subject benchmarking breakdown.

---

## 5. Verification & Testing Strategy

- **Backend Unit Tests**: Verify `AnalyticsService.get_monthly_benchmark()` calculation with 0 attempts, 1 attempt, and 5+ attempts.
- **API Response Validation**: Ensure JSON matches contract schema.
- **Frontend End-to-End Test**: Verify dashboard and Monthly Report page render accurate calculated metrics for logged-in test users.
