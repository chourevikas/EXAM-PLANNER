# AI Study Planner – Complete Project Handover Context

This document is intended to provide a new AI coding assistant with enough context to continue development without requiring previous conversations.

## 1. Project Overview & Goals
**Project Name:** AI Study Planner

**Vision:**
The AI Study Planner is an end-to-end exam preparation platform that combines:
- AI-generated study plans
- Previous year question analysis
- Mock tests
- Revision management
- Performance analytics
- Gamification
- Progress tracking

into one centralized application.

The goal is not to become another note-taking application.
The goal is to become an AI-powered preparation companion for competitive exams.

**Problem Being Solved:**
Students preparing for exams like UPSC, SSC, Banking, GATE, CAT, JEE, NEET, University exams typically use multiple applications: PDFs, YouTube, Previous Year Papers, Notes, Timetable, Test Series, Revision trackers. Everything is scattered. This platform brings everything together and allows AI to personalize preparation.

## 2. Core User Flow
User enters:
- Name
- Exam
- Attempt Year
- Subjects (optional)

System generates:
- AI Study Plan
- Previous Year Questions
- Mock Tests
- Revision Schedule
- Analytics Dashboard

## 3. Major Features
The project is divided into modules:

**Module 1 — Authentication**
Register, Login, Forgot Password, Email Verification, JWT Authentication, Refresh Tokens, User Profile

**Module 2 — User Profile**
Name, Email, Exam, Attempt Year, Preferred Subjects, Target Score, Daily Study Hours, Timezone, Avatar

**Module 3 — AI Study Planner**
- Input: Exam, Attempt Year, Available Hours, Subjects, Current Preparation Level
- Output: Daily Plan, Weekly Plan, Monthly Plan
- Should dynamically adjust if: user misses tasks, exam date changes, performance changes

**Module 4 — Previous Year Questions (PYQ)**
- Store approximately last 20 years papers.
- Each paper contains: Questions, Options, Correct Answer, Explanation, Difficulty, Subject, Topic, Chapter, Year, Marks, Negative Marks.
- Users can: Solve online, Filter, Bookmark, Review, Practice chapter-wise.

**Module 5 — Mock Tests**
Timed Tests, Custom Tests, Topic Tests, Full Length Tests, AI Generated Tests.
Results include: Accuracy, Time Taken, Rank, Weak Topics, Suggestions.

**Module 6 — Revision Planner**
Generates Revision cycles (Revision 1, 2, 3), Smart reminders, Priority based revision, Weak topic revision.

**Module 7 — Analytics**
Dashboard includes: Daily Hours, Weekly Progress, Monthly Progress, Completion %, Subject-wise Progress, Topic-wise Progress, Weak Areas, Strong Areas, Study Heatmap, Predicted Score.

**Module 8 — AI Analysis**
After every Mock Test or PYQ Session, AI provides: Strengths, Weaknesses, Recommended Revision, Next Topics, Difficulty Analysis, Estimated Rank, Confidence Score.

**Module 9 — Gamification**
Includes: Study Streak, XP Points, Levels, Achievements, Badges, Milestones, Leaderboard (optional).
*Important Design Decision:* Study streak should not exist as a separate table. Maintain streak information inside the User Profile (currentStreak, highestStreak, lastStudyDate, totalXP, level). Achievements, Badges, XP Logs should have their own tables.

**Module 10 — Notifications**
Daily Reminder, Revision Reminder, Mock Reminder, Exam Countdown, Missed Study Reminder, Achievement Notification.

**Module 11 — Resources**
Store PDFs, Books, Links, Videos, Notes organized by Exam, Subject, Topic.

**Module 12 — Search**
Search Questions, Topics, Subjects, Resources, Notes, Tests.

**Module 13 — Admin Panel**
Manage Exams, Subjects, Questions, Users, Reports, Resources, Mock Tests.

**Module 14 — AI Chat Assistant**
Students can ask: Explain this topic, Generate questions, Create revision notes, Summarize chapter, Solve doubt, Generate mnemonics.

## 4. Features Explicitly NOT in Current Scope
❌ AI Face Recognition
❌ Voice Interview
❌ Real-time AI Interview
❌ Camera Monitoring
❌ Proctoring
❌ Speech Evaluation

## 5. Required Documentation
**Functional Documents:** SRS, Use Case Document, Functional Requirement Specification
**Technical Documents:** HLD, LLD, Database Design, API Documentation, Deployment Guide

## 6. Database Design Direction
Expected major entities include: User, Exam, Subject, Topic, Chapter, StudyPlan, StudyTask, RevisionPlan, RevisionTask, Question, QuestionOption, MockTest, MockTestQuestion, MockTestAttempt, QuestionAttempt, Performance, Resource, Bookmark, Notification, Achievement, Badge, XPLog, UserProgress.

*(Detailed schema attributes are recorded in the handover documentation and will guide the formalized ERD).*

## 7. Architecture Direction
Client → API Gateway → Backend → Services (Auth, AI, Planner, Questions, Mock Test, Revision, Analytics, Notification) → Database

## 8. AI Components
AI will power: Study Plan Generation, Revision Scheduling, Weak Topic Detection, Question Recommendation, Performance Analysis, Mock Analysis, Revision Suggestions, AI Tutor.

## 9. Analytics
Should calculate: Daily Study Hours, Completion Rate, Subject Accuracy, Topic Accuracy, Average Time, Consistency Score, Revision Completion, Predicted Exam Score, Expected Rank, Study Streak, XP Progress.

## 10. Gamification Logic
- XP Sources: Daily Study, Task Completion, Mock Completion, Revision Completion, Achievements.
- Badges unlock automatically. Levels determined by XP thresholds.
- Study streak increments only when the daily study goal is achieved.

## 11. Current Progress
- Core infrastructure and CI/CD pipelines are fully operational.
- Deployed on AWS EC2 with automated Docker builds via GitHub Actions.
- Clerk Authentication integrated across frontend and backend, replacing legacy custom JWT logic.
- FastAPI-Mail integration complete for email services.
- Database schema and core models (User, Profile, etc.) are implemented using SQLModel/SQLAlchemy.
- Base UI layouts (StudentLayout) and multiple frontend pages (Dashboard, Study Planner, Mock Selection, etc.) are built.
- Celery & Redis pipeline integration established.
- Live Exam Engine interface, Admin panel views, and Analytics dashboards have been developed and integrated with backend services.
- Release branch `release/0.0.1` has been updated with these core frontend and backend components.

## 12. What Can Be Done Next
1. **Module 3 (AI Study Planner):** Implement the actual AI logic using LangChain/Google GenAI to generate personalized study plans based on user profiles.
2. **Module 4 (PYQ Integration):** Build the data ingestion pipeline to parse and store the 20-year Previous Year Questions database, and connect it to the frontend UI.
3. **Refine Exam Engine & Analytics:** Fine-tune the backend logic for custom mock test generation and the live exam-taking engine UI, mapping frontend charts to live backend endpoints.
4. **Background Tasks:** Utilize the newly integrated Celery workers to handle heavy background processing (like PDF parsing or scheduled email reminders).

## 13. Tech Stack & Architecture Status
**Frontend:** React 18, Vite, TypeScript, Recharts, Clerk Auth.
**Backend:** Python 3.12, FastAPI, SQLModel/SQLAlchemy, Celery, Redis, LangChain, Google GenAI, FastAPI-Mail.
**Infrastructure:** Docker, Docker Compose, AWS EC2, GitHub Actions (CI/CD), PostgreSQL.

## 14. Database Schema Status
Core user and authentication schemas are active and migrating successfully via Alembic. Sub-modules (PYQ, Mocks, Study Plans) need their schemas formalized and migrated as those modules are built out.

## 15. Codebase Status
Active development phase. Backend and frontend are modularized in a monorepo-style structure under `apps/backend` and `apps/frontend`. 

## 16. Important Project Constraints & Decisions
- No scope creep beyond documented requirements.
- Modular platform separation.
- AI layer is advisory/personalization-focused.
- Study streak state belongs on User profile.
- PYQ is a first-class feature (20-year storage).
- Data-driven interconnection (performance improves future plans).
