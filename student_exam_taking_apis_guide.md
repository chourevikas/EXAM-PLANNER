# 🎓 RankEdge Student Exam-Taking API Lifecycle Specification v2

This document provides a complete end-to-end technical reference and API contract for the entire lifecycle when a student takes an exam on **RankEdge**.

---

## 📌 Base URL & Headers

- **Base URL**: `/api/v1`
- **Auth**: All endpoints require `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

---

## 📋 Common Enums

### `AttemptMode`
- `EXAM`: Real simulation — timed, answer reveal blocked until submission.
- `PRACTICE`: Practice mode — timed, can reveal answers per-question after selecting an option.
- `REVISION`: Revision mode — timed, can reveal answers, retention-focused matrix selection.

### `QuestionResponseStatus`
- `UNVISITED`: Question never opened.
- `VISITED`: Question opened but no option selected.
- `ANSWERED`: Option selected.
- `MARKED_FOR_REVIEW`: Flagged for review (no option selected).
- `ANSWERED_AND_MARKED`: Option selected AND flagged for review.

---

## 🚀 1. Pre-Exam: List & Start

### 1.1 List Available Exams
`GET /api/v1/exams`

Query params: `category`, `year`, `stage`, `is_active` (default true), `skip`, `limit`.

### 1.2 Start Exam Attempt
`POST /api/v1/attempts/start`

**Request Body:**
```json
{
  "exam_id": "2e2313d4-b8ec-4cc2-a48e-efd0d4af745b",
  "mode": "EXAM"
}
```

**Response (`201 Created`):**
```json
{
  "attempt_id": "8f3b12a9-5c12-4d33-91ab-ee92019a12bc",
  "exam_id": "2e2313d4-b8ec-4cc2-a48e-efd0d4af745b",
  "status": "IN_PROGRESS",
  "mode": "EXAM",
  "started_at": "2026-08-10T22:30:00Z",
  "max_duration_seconds": 7200,
  "total_questions": 100,
  "first_question": {
    "question": {
      "question_id": "a1b2c3d4-0001-4000-8000-000000000001",
      "question_number": 1,
      "text": "Consider the following statements regarding...",
      "options": [
        { "option_id": "opt-a-uuid", "option_label": "A", "text": "1 only" },
        { "option_id": "opt-b-uuid", "option_label": "B", "text": "2 only" }
      ],
      "subject": "Economy",
      "topic": "Monetary Policy",
      "subtopic": "Repo Rate Transmission",
      "difficulty": "MEDIUM",
      "marks": 2.0,
      "negative_marks": 0.66,
      "expected_time_seconds": 60
    },
    "navigation": { "current": 1, "total": 100, "has_next": true, "has_prev": false },
    "response_state": {
      "selected_option_id": null,
      "is_marked_for_review": false,
      "time_spent_seconds": 0.0,
      "question_status": "UNVISITED",
      "answer_revealed": false
    }
  },
  "palette": [
    { "question_number": 1, "question_id": "...", "question_status": "UNVISITED" }
  ]
}
```

---

## ⏱️ 2. In-Exam: Navigation, Telemetry & Response Tracking

### 2.1 Get Question (Next / Previous / Jump)
`GET /api/v1/attempts/{attempt_id}/questions/{question_number}`

- Next: `{current + 1}`
- Prev: `{current - 1}`
- Jump: `{any_number}`

### 2.2 Save Response & Telemetry
`POST /api/v1/attempts/{attempt_id}/responses`

**Request Body:**
```json
{
  "question_id": "a1b2c3d4-0005-4000-8000-000000000005",
  "selected_option_id": "opt-5a-uuid",
  "is_marked_for_review": false,
  "time_spent_seconds": 45.2,
  "option_switch_count": 2
}
```

### 2.3 Reveal Answer (PRACTICE / REVISION Mode Only)
`POST /api/v1/attempts/{attempt_id}/reveal/{question_id}`

*Note: Blocked in `EXAM` mode with `403 REVEAL_BLOCKED_IN_EXAM_MODE`.*

### 2.4 Heartbeat & Timer Sync
`POST /api/v1/attempts/{attempt_id}/heartbeat`

**Request Body:**
```json
{
  "remaining_time_seconds": 6120,
  "active_question_id": "a1b2c3d4-0005-4000-8000-000000000005"
}
```

### 2.5 Get Session Status & Palette
`GET /api/v1/attempts/{attempt_id}/status`

---

## 🏁 3. Exam Submission

### 3.1 Submit Exam Attempt
`POST /api/v1/attempts/{attempt_id}/submit`

**Request Body:**
```json
{
  "submission_reason": "USER_CLICKED_SUBMIT"
}
```

---

## 📊 4. Post-Exam Analytics Reports

- `GET /api/v1/analytics/reports/user/{user_id}/exam/{exam_id}/json`
- `GET /api/v1/analytics/reports/user/{user_id}/exam/{exam_id}/yaml`
- `GET /api/v1/analytics/reports/user/{user_id}/exam/{exam_id}/markdown`

---

## 📁 5. S3 / Local Storage JSON Cache Architecture

For each exam processed by Pipeline 3, two standardized JSON files are generated and stored:

1. **`exams/{exam_code}/exam_questions.json`**: Used during live exam-taking. Contains question text, options (without `is_correct`), topics, and difficulty.
2. **`exams/{exam_code}/exam_solutions.json`**: Used for answer reveal and post-submission evaluation. Contains correct options, explanations, Bloom's level, IRT parameters, and distractor closeness scores.
