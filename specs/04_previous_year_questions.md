# Module 4: Previous Year Questions (PYQ)

## Overview
One of the core pillars of the application. Allows users to practice real exam questions from the past, typically extracted from past PDFs.

## Core Requirements
- **Storage**: Must store approximately the last 20 years of papers.
- **Data per Question**:
  - Questions
  - All Options
  - Correct Answer
  - Explanation
  - Difficulty (EASY, MEDIUM, HARD)
  - Subject, Topic, Sub-Topic, Chapter
  - Current Affair (flag/tag)
  - Source Year
  - PDF Reference
  - Marks and Negative Marks
  - Estimated Time in Seconds

## Dynamic Difficulty Management
- The difficulty level of a question (EASY, MEDIUM, HARD) is not just static.
- **Dynamic Scale**: The system will track the percentage of users who answer the question correctly or incorrectly.
- **Thresholds**: Based on predefined thresholds (e.g., if 80% answer correctly, it becomes EASY; if 20%, it becomes HARD), the system will dynamically adjust the question's difficulty level over time.

## User Actions
- **Solve online**: Practice questions in a digital interface.
- **Filter**: By Exam, Subject, Topic, Years, and Difficulty Level.
- **Bookmark**: Save questions for later review.
- **Review**: Look at past attempts and explanations.
- **Practice chapter-wise**: Focus on specific topics (Adaptive Learning).

## Data Ingestion Format (YAML)
All PYQs are collected as YAML records with strict schemas to ensure validation, parsing, and classification consistency.

Key Rules:
1. Use approved taxonomy for tags.
2. Assign one primary tag path (Subject -> Topic -> Sub_Topic).
3. Tag the tested concept, not a keyword.
4. Retain original content.
5. Use verified answers.
6. Keep image references external.
