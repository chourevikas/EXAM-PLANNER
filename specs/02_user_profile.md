# Module 2: User Profile

## Overview
Stores and manages the user's personal details and study preferences.

## Data Stored
- **Name**: User's full name.
- **Email**: User's verified email address.
- **Exam**: The target exam the user is preparing for (e.g., UPSC, SSC, Banking).
- **Attempt Year**: The year the user plans to take the exam.
- **Subjects**: Specific subjects the user wants to focus on (Optional and Major subjects).
- **Target Score**: User's desired score or rank.
- **Daily Study Hours**: How many hours the user commits to studying per day.
- **Timezone**: To accurately schedule daily tasks and reminders.
- **Avatar**: Profile picture or avatar.

## Integration
- **Gamification**: Study streak (currentStreak, highestStreak, lastStudyDate, totalXP, level) is stored within the User Profile, rather than a separate table.
- **Onboarding**: Most of these details are collected during the initial user onboarding flow after signup.

## Reports & Tracking
- **Weekly Report**: Aggregates the user's progress, total study hours, XP gained, and completed subjects for the past 7 days. Helps in micro-adjustments to the study planner.
- **Monthly Report**: Comprehensive view of the user's performance, consistency, subject mastery, and overall trajectory towards their target exam over the month. Used for macro-planning and identifying weak spots.
