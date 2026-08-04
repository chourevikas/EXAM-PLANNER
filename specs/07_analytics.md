# Module 7: Analytics

## Overview
Provides a comprehensive dashboard to track the user's study progress, performance, and retention.

## Dashboard Metrics
- **Strong Subjects & Need Improvement**: Distinctly highlights strong areas vs. weak areas needing attention.
- **Time Management**: Evaluated at both the per-question and entire-exam level. There is a pre-defined expected time for each question (based on difficulty). The user's response time is compared against this scale to evaluate their time management skills.
- **Accuracy**: Based on the optio selected. The system also factors in the "option nearest to right answer" to provide deeper insights into the user's thought process or partial understanding.
- **Rank Prediction**: Estimates the user's overall rank based on their mock performance.
- **Retention**: Measured specifically using **Weekly Mocks**. These mocks re-introduce 50% of the questions from the previous week's paper, but with the *language/phrasing changed*. How the user performs on these indicates true concept retention versus rote memorization.
- **Behaviour Analysis**: Deep behavioral tracking based on the manner in which the user attempts the examination (e.g., question jumping, hesitation, order of attempts).

## Additional Calculated Analytics
- Daily Study Hours
- Completion Rate
- Subject/Topic Accuracy
- Average Time per question
- Consistency Score
- Study Streak & XP Progress

## Database & Freemium Strategy
- **Store Everything Policy:** To maximize upsell conversions, the database stores the complete, deep analytical profile (including psychometrics, behavior analysis, and estimated rank) for *all* registered users, regardless of their subscription tier.
- **Frontend Blur Hook:** At the API layer, endpoints return a `has_premium_access: boolean` flag. For Free Tier users, the UI renders the deep insights but applies a CSS blur effect (`backdrop-filter: blur()`) with a lock icon, creating strong curiosity and driving users to upgrade.
- **Table Structure:** All analytics will be stored in a unified `TestAnalysis` table linked to the `User` table, ensuring there is no schema duplication between Free and Premium tiers. When a user upgrades, their historical insights are instantly unlocked.
