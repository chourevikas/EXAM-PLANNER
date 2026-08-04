# Module 3: AI Study Planner

## Overview
The core AI-powered engine that generates personalized study plans for users based on their specific exams, hours, and goals.

## Input Parameters
- **Exam**: The target exam (from User Profile).
- **Attempt Year**: The target year (from User Profile).
- **Available Hours**: Daily study hours (from User Profile).
- **Subjects**: Preferred or required subjects.
- **Current Preparation Level**: either based on a mock after he gets the subscription    

## Outputs
- **Daily Plan**: Specific tasks and topics to cover each day.
- **Weekly Plan**: A broader overview of weekly goals.
- **Monthly Plan**: Long-term milestones leading up to the exam.

## Dynamic Adjustments
The planner must be dynamic and automatically adjust if:
- The user misses scheduled tasks.
- The exam date is changed or announced.
- The user's performance in Mock Tests or PYQs changes (e.g., they learn faster or slower than expected).
