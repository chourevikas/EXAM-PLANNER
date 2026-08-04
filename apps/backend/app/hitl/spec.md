# Module Specification: Human-In-The-Loop Admin QA (`hitl/`)

## Overview
The `hitl` module manages Admin quality assurance, question verification, text/passage corrections, option edits, diagram asset updates, and automated LLM sequential re-extraction retries.

## Business Laws
1. **Mandatory Review**: Every extracted question starts in `PENDING_HUMAN_REVIEW` status and cannot be published until explicitly verified by an Admin.
2. **Full Editing Capabilities**:
   - Admin can edit Reading Passage Context (`updated_passage_text`).
   - Admin can edit Question Stem text (`updated_question_text`).
   - Admin can edit Option labels, texts, and correctness flags (`updated_options`).
   - Admin can adjust/replace Diagram Image Assets (`updated_assets`).
3. **LLM Sequential Re-Extraction Retry**:
   - If an Admin chooses to use LLM re-extraction instead of manual editing, `trigger_llm_reextraction_for_question` isolates the specific target pages of the question/passage and re-runs vision extraction asynchronously.

## Service API (`hitl/review_service.py`)
- `async get_pending_review_tasks(...)`
- `async get_question_review_detail(...)`
- `async update_and_approve_question(...)`
- `async trigger_llm_reextraction_for_question(...)`
