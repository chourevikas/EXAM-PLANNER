# Analytics: AIR Rank Prediction Engine - Technical Spec

## 1. Overview
The "Predicted Rank" widget on the Student Dashboard provides users with an estimated All India Rank (AIR) and Percentile for their target exam. Rather than relying solely on the platform's internal user base (which may not represent the entire competitive landscape), this engine uses **Historical Cutoff Data** combined with the user's **Weighted Moving Average** from mock tests.

This specification outlines the algorithm tailored specifically for **UPSC CSE Prelims (General Studies Paper 1)**, though the architecture is exam-agnostic and can be scaled to SSC, Banking, etc., by swapping the historical constants.

## 2. Core Mathematical Algorithm

### Step 1: Calculate Weighted Moving Average (WMA)
To get an accurate representation of the student's *current* capability, we do not use a simple average of all time. We use the last 5 full-length mock tests, weighing recent tests more heavily.

Given Mock Scores: $S_1, S_2, S_3, S_4, S_5$ (where $S_5$ is the most recent):
$$ WMA = \frac{(S_1 \times 1) + (S_2 \times 2) + (S_3 \times 3) + (S_4 \times 4) + (S_5 \times 5)}{15} $$
*(Maximum marks = 200 for UPSC Prelims)*

### Step 2: Map Score to a Percentile Curve
Using historical UPSC cutoff trends, we map the WMA to an estimated percentile.
*Assumed distribution constants for UPSC (can be adjusted via admin panel):*
- **< 60 marks:** Base percentile (Linear scale 0 - 40th percentile)
- **60 - 80 marks:** 40th to 75th percentile
- **80 - 95 marks:** 75th to 95th percentile (The typical cutoff zone)
- **95 - 110 marks:** 95th to 99th percentile
- **> 110 marks:** 99.0 to 99.99th percentile

**Example Interpolation (Score = 90):**
If 80 marks = 75th percentile and 95 marks = 95th percentile.
A score of 90 is 66% of the way between 80 and 95.
Percentile = $75 + (0.66 \times (95 - 75)) = 88.3\text{th Percentile}$.

### Step 3: Calculate the Predicted Rank
We use a constant representing the estimated total number of actual test-takers for the exam. For UPSC Prelims, roughly **500,000** candidates appear.

$$ \text{Top Percentage} = 100 - \text{Percentile} $$
$$ \text{Predicted Rank} = \text{Total Candidates} \times \left( \frac{\text{Top Percentage}}{100} \right) $$

**Example:**
- Percentile = $88.3$
- Top Percentage = $11.7\%$
- Predicted Rank = $500,000 \times 0.117 = 58,500$

## 3. Database & Schema Requirements
To support this, we need a configuration table to store exam-specific constants so they aren't hardcoded.

### `ExamAnalyticsConfig` Model
- `id` (UUID)
- `exam_id` (FK to Exam)
- `total_candidates` (int, e.g., 500000)
- `percentile_brackets` (JSONB, stores the mapping curve: `[{"score": 80, "percentile": 75}, {"score": 95, "percentile": 95}]`)
- `max_marks` (int, e.g., 200)

## 4. API Specification
**Endpoint:** `GET /api/v1/analytics/predicted-rank`

**Response Payload:**
```json
{
  "exam": "UPSC CSE Prelims",
  "moving_average_score": 90.0,
  "predicted_percentile": 88.3,
  "top_percentage": 11.7,
  "predicted_rank": 58500,
  "confidence_score": "HIGH" // Based on number of mocks taken (e.g. > 5 is HIGH)
}
```

## 5. Implementation Plan
1. **Mock Test Dependency:** This engine requires the Mock Test assessment pipeline to be completed first, as it relies on `MockTestAttempt` records.
2. **Service Layer (`analytics_service.py`):** Implement the math functions (`calculate_wma`, `interpolate_percentile`, `calculate_rank`).
3. **Admin Configuration:** Build UI in the Admin Panel to adjust the `percentile_brackets` every year as UPSC trends change.
4. **Dashboard Integration:** Wire the frontend widget to display the calculated `top_percentage` and `predicted_rank`.
