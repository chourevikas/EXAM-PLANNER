# Study Activity Log Engine - Technical Spec

## 1. Overview
The **Study Activity Log** acts as the central truth for what a student *actually* did, as opposed to what the AI *planned* for them to do. By capturing the time spent and the *quality/outcome* of the study session (e.g., questions correct, confidence level), this engine feeds directly into the Gamification Engine, Analytics Dashboard, and future AI Recommendations.

## 2. Core Philosophy
- **Time spent ≠ Productive study:** We capture outcomes (Accuracy, Confidence, Scores).
- **Dynamic Logging:** Not every activity requires the same fields. A "Mock Test" log requires total questions and accuracy, whereas a "New Topic" log requires a completion status.
- **Single Source of Truth:** A unified `study_activities` table prevents architecture bloat while allowing specific details to be stored in a JSON payload or lightweight child tables.

## 3. Database Schema

### `StudyActivity` Model (in `analytics.py` or `study_plan.py`)
```python
class StudyActivityType(str, Enum):
    REVISION = "REVISION"
    NEW_TOPIC = "NEW_TOPIC"
    ANSWER_WRITING = "ANSWER_WRITING"
    PYQ = "PYQ"
    MOCK_TEST = "MOCK_TEST"
    CURRENT_AFFAIRS = "CURRENT_AFFAIRS"
    OTHER = "OTHER"

class StudyActivity(SQLModel, table=True):
    __tablename__ = "study_activities"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    date: date = Field(default_factory=lambda: datetime.now(timezone.utc).date())
    
    activity_type: StudyActivityType
    subject: Optional[str] = None
    topic: Optional[str] = None
    duration_minutes: int = Field(default=0)
    
    # Outcomes / Quality Metrics (Sparse fields depending on activity_type)
    questions_attempted: Optional[int] = None
    questions_correct: Optional[int] = None
    score: Optional[float] = None
    confidence_rating: Optional[int] = None # 1 to 10
    
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```
*(We use sparse columns instead of separate tables for v1 to maintain a clean, highly queryable architecture for analytics aggregations).*

## 4. API Endpoints
**1. `POST /api/v1/analytics/activity`**
- **Description:** Logs a new study activity.
- **Payload:**
```json
{
  "activity_type": "PYQ",
  "subject": "Polity",
  "topic": "Fundamental Rights",
  "duration_minutes": 90,
  "questions_attempted": 50,
  "questions_correct": 38
}
```

**2. `GET /api/v1/analytics/activity/today`**
- **Description:** Fetches all activities logged today to display in the Activity History feed.

**3. `GET /api/v1/analytics/summary`**
- **Description:** Aggregates total hours and accuracy metrics by subject and activity type for the current week. Feeds the Time Management and Planned vs Actual charts.

## 5. Frontend Implementation (Dashboard)

### 5.1 Quick Log Modal
A dynamic modal triggered by the `+ Log Study Activity` button.
- **Step 1:** Select `Activity Type` (Pills/Buttons: Revision, PYQ, Mock, etc.)
- **Step 2:** Form adapts based on type.
  - *If Mock/PYQ:* Show `Questions Attempted` and `Questions Correct`.
  - *If Revision:* Show `Confidence Rating (1-10)`.

### 5.2 Today's Study Feed
Replace the current Time Management area chart with a two-column view if on desktop:
- **Left:** The Analytics Charts (Planned vs Actual).
- **Right:** A vertical feed of "Today's Study Activity" showing color-coded cards (e.g., 🟢 Revision - Polity - 2h 15m) and a total aggregated time at the top.

## 6. Architecture Integration Flow
```text
[ Quick Log Modal ] ➔ POST /activity ➔ [ DB: study_activities ]
                                                │
                                                ├─➔ Gamification Hook (Awards XP)
                                                ├─➔ Time Management Chart (Dashboard)
                                                └─➔ Future: AI Study Planner Constraints
```
