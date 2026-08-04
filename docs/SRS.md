# Software Requirements Specification (SRS)
**Project:** AI Study Planner
**Version:** 1.0

---

## 1. Introduction
### 1.1 Purpose
The purpose of this document is to detail the software requirements for the AI Study Planner platform. It covers the functional and non-functional requirements, target audience, and system architecture.

### 1.2 Project Vision
The AI Study Planner is an end-to-end exam preparation platform designed to replace fragmented study methods. It acts as an AI-powered preparation companion for competitive exams (UPSC, SSC, Banking, etc.) by combining personalized study plans, PYQs, mock tests, and gamification.

### 1.3 Out of Scope
The following features are explicitly excluded from this system:
- AI Face Recognition
- Voice/Real-time AI Interviews
- Camera Monitoring / Proctoring
- Speech Evaluation

---

## 2. Overall Description
### 2.1 User Roles
- **Student**: The primary user who consumes study plans, takes tests, and tracks progress.
- **Admin**: Manages questions, resources, users, and quality assurance.
- **Super Admin**: Manages organization-level settings and admin roles.

### 2.2 Core User Flow
1. **Signup & Onboarding**: User registers and inputs Name, Exam, Attempt Year, and Major Subjects.
2. **Dashboard**: User lands on a dashboard featuring their AI Study Plan, gamification stats (Streak, XP), and quick actions.
3. **Core Actions**: User can practice PYQs, take Mock Tests, review resources, or ask the AI Chat Assistant questions.
4. **Analytics Loop**: Performance data from tests feeds back into the AI to adjust future study plans and generate targeted revision cycles.

---

## 3. Functional Requirements

### 3.1 Authentication & User Profile (Modules 1 & 2)
- **FR1.1**: The system must allow users to register and login using email/password.
- **FR1.2**: The system must support JWT authentication with refresh tokens.
- **FR1.3**: The system must store user profile data including target exam, attempt year, and subjects.

### 3.2 AI Study Planner & Revision (Modules 3 & 6)
- **FR2.1**: The system must generate a daily, weekly, and monthly study plan based on user inputs.
- **FR2.2**: The system must dynamically adjust the plan if tasks are missed or performance changes.
- **FR2.3**: The system must schedule spaced repetition revision cycles for completed topics.

### 3.3 Previous Year Questions (PYQ) (Module 4)
- **FR3.1**: The system must store PYQs with tags for Subject, Topic, Subtopic, Difficulty, and Current Affairs.
- **FR3.2**: The system must dynamically adjust the difficulty rating of a question based on user success/failure rates.
- **FR3.3**: The system must allow users to filter, solve, and bookmark PYQs.

### 3.4 Mock Tests (Module 5)
- **FR4.1**: The system must support Full Syllabus Mock Tests matching exact exam patterns.
- **FR4.2**: The system must support Topic-Based Mock Tests with adaptive difficulty (leveling up as the user answers correctly).

### 3.5 Analytics & AI Analysis (Modules 7 & 8)
- **FR5.1**: The system must track time management by comparing user response time against a pre-defined expected time per question.
- **FR5.2**: The system must calculate accuracy, factoring in partial insights (options nearest to the correct answer).
- **FR5.3**: The system must measure retention through weekly mocks that change the language/phrasing of previously seen questions.
- **FR5.4**: The system must provide AI-driven insights highlighting strong subjects and areas needing improvement.

### 3.6 Gamification (Module 9)
- **FR6.1**: The system must track a "Study Streak" and a "Mock Streak".
- **FR6.2**: The system must award XP and Badges based on completed missions (e.g., number of tests taken).
- **FR6.3**: The system must calculate and display an Overall Rank among peers.

---

## 4. Non-Functional Requirements
- **Performance**: API responses must remain under 200ms. AI generation tasks (like study plan creation) can be asynchronous.
- **Scalability**: The architecture must support modular microservices to scale Mock Tests and PYQ processing independently.
- **Security**: Passwords must be hashed (e.g., bcrypt). JWT tokens must be securely transmitted.
- **Availability**: The system aims for 99.9% uptime, utilizing cloud object storage (S3/GCS) for robust PDF and image hosting.

---

## 5. Next Steps for Implementation
1. Finalize REST API and GraphQL endpoints.
2. Select exact Tech Stack (Frontend/Backend frameworks).
3. Begin Phase 1 (Auth & User Onboarding development).
