# Gamification & Study Streak Engine - Technical Spec

## 1. Overview
The Gamification Engine is designed to drive user retention and consistent study habits on the Exam Planner platform. Rather than rewarding simple logins, the system strictly rewards actual study progress. The core pillars of this engine are:
1. **Daily Study Streak:** Maintained only when all AI-assigned tasks for a given day are completed.
2. **XP & Leveling:** Users earn Experience Points (XP) for completing tasks, mocks, and maintaining streaks.
3. **Badges:** Unlockable achievements based on XP thresholds or specific milestones.

## 2. Core Philosophy & Constraints
- **Action-Driven, Not Login-Driven:** A user opening the app does *not* increment their streak. The streak only increments when the `POST /api/v1/study-plan/tasks/{task_id}/complete` API determines that the final task for the day has been completed.
- **Data Normalization:** The study streak is a property of the user (`StudentProfile`), not a standalone table. We track `current_streak`, `highest_streak`, and `last_study_date`.
- **Decoupled LLM Generation:** The Gamification engine does not care how tasks are generated (whether manually or via LLM). It only checks the `StudyTask` database table to see if `is_completed = True` for all of today's tasks.

## 3. Database Schema Updates

### 3.1 StudentProfile Updates
The `StudentProfile` model (in `user.py`) requires the following fields:
- `current_streak` (int): Current consecutive days of hitting the daily goal.
- `highest_streak` (int): All-time highest streak.
- `total_xp` (int): Accumulated XP.
- `level` (int): Current user level (calculated or stored based on XP).
- `last_study_date` (datetime): The exact date the user last completed a daily goal.

### 3.2 New Models (gamification.py)
- **XPLog:** Tracks every XP transaction (e.g., `user_id`, `amount`, `source="DAILY_GOAL"`, `created_at`).
- **Badge:** Defines available badges (e.g., `id`, `name`, `description`, `icon_url`, `required_xp`).
- **UserBadge:** Join table for unlocked badges (e.g., `user_id`, `badge_id`, `unlocked_at`).

### 3.3 Study Plan Models (study_plan.py)
To make the streak functional, basic task tracking is required:
- **StudyTask:** Represents an AI-generated or user-created task.
  - `id`, `user_id`, `title`, `scheduled_date` (date), `is_completed` (boolean).

## 4. Architectural Approach & Logic Flow

### Step 1: Task Completion
When a user finishes a task, the frontend calls `POST /api/v1/study-plan/tasks/{task_id}/complete`.
1. Backend sets `StudyTask.is_completed = True`.
2. Backend triggers the **Gamification Engine Hook**.

### Step 2: The Gamification Engine Hook
The Gamification service evaluates the user's progress for `today`:
1. **Query:** `SELECT COUNT(*) FROM study_tasks WHERE user_id = X AND scheduled_date = TODAY AND is_completed = False`.
2. **Evaluation:** If count > 0, the daily goal is not yet met. Return standard success.
3. **Daily Goal Met (Count == 0):**
   - Check `StudentProfile.last_study_date`.
   - If `last_study_date == yesterday`: `current_streak += 1`.
   - If `last_study_date < yesterday`: `current_streak = 1` (streak reset).
   - If `last_study_date == today`: Do nothing (streak already recorded).
   - Update `last_study_date = today`.
   - If `current_streak > highest_streak`, update `highest_streak`.

### Step 3: XP and Rewards
Once the Daily Goal is verified:
1. Generate an `XPLog` entry for `source="DAILY_GOAL"` with amount `+50 XP`.
2. Update `StudentProfile.total_xp += 50`.
3. Evaluate if `total_xp` crosses a leveling threshold. If so, increment `StudentProfile.level`.
4. Return a gamification payload to the frontend (e.g., `{"streak_updated": true, "new_xp": 50, "level_up": false}`).

## 5. Implementation Phases

**Phase 1 (Current Focus): Core Data & Gamification Engine**
- Create database models for Gamification (`XPLog`, `Badge`, `UserBadge`).
- Update `StudentProfile` schema.
- Create dummy `StudyTask` schema to support the logic.
- Implement the completion API and backend streak logic.
- *Testing:* Manually inject dummy tasks and verify that completing them triggers the streak correctly.

**Phase 2 (Future Focus): AI Generation**
- Integrate LangChain/Google GenAI to automatically populate the `StudyTask` table with personalized study schedules.
