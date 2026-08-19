# Module Specification: PDF Question & Answer Key Extraction Pipelines (`pipeline/`)

## Overview
The `pipeline` module provides two specialized LangGraph pipelines:
1. **PDF Question Extraction Pipeline (`pipeline/graph.py`)**: Vision extraction, storage-aware loading, DSU passage stitching, and artifact exporting.
2. **Answer Key Extraction & Set Mapping Pipeline (`pipeline/answer_key_graph.py`)**: Answer key table parsing, paper set code detection (Set A, B, C, D), set validation, and DB answer key mapping.

---

## 1. Question Extraction Pipeline (`pipeline/graph.py`)
- Parallel map worker across PDF pages using `ainvoke_extraction_llm`.
- Deterministic Disjoint Set Union (DSU) passage stitcher.
- Mandatory HITL audit task creation in `PENDING_HUMAN_REVIEW` status.
- Dual exporter writing matching `.yaml` and `.md` canonical files.

---

## 2. Answer Key Extraction & Set Mapping Pipeline (`pipeline/answer_key_graph.py`)
- **Vision Engine (`pipeline/answer_key_extractor.py`)**:
  - `ainvoke_answer_key_llm`: Extracts question-to-answer mappings (`Q1 -> B`) and detects Question Paper Set Code from page header (`SET_A`, `SET_B`, `SET_C`, `SET_D`, `ALL_SETS`).
- **Set Validation & DB Mapper (`node_validate_set_code_and_map_db`)**:
  - **Set Matching Law**: Compares `detected_paper_set_code` against `target_set_code` / `exam.paper_set_code`.
  - **Safety Threshold**: If detected set code does NOT match target paper set code (e.g. image is `SET_C` but target paper is `SET_A`), the pipeline flags `SET_MISMATCH_SKIPPED` and skips DB mapping to prevent answer key corruption!
  - When set code matches, it sets `QuestionOption.is_correct = True` for the matched choice option and records audit entries in `AnswerKeyBatch` and `AnswerKeyMapping`.
