# Module 9: Gamification

## Overview
Drives user engagement and consistency through game-like mechanics, rewards, and missions.

## Core Features
- **XP (Experience Points)**: The core currency of gamification. Earned through completing missions, tasks, and studying.
- **Badges**: Awarded based on accumulated XP milestones.
- **Missions**: Specific challenges for the user to complete. Examples include:
  - Answering a certain number of EASY or TOUGH questions.
  - Completing a set number of mock tests.
  - Hitting specific streaks.
- **Study Streak**: Tracks consecutive days of meeting study goals.
- **Mock Streak**: A separate streak specifically tracking consecutive days/weeks of taking mock tests.
- **Overall Rank**: A gamified leaderboard rank showing how the user stacks up against peers based on XP and mock performance.

## Design Decisions
- **Streak Management**: Study streak data (`currentStreak`, `highestStreak`, `lastStudyDate`, `totalXP`, `level`) is stored directly on the User Profile entity to avoid unnecessary table joins.
- **Separate Entities**: Achievements, Badges, and XP Logs will have their own dedicated tables in the database.
