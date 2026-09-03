# Deterministic Document Extraction Pipeline

## Overview

This pipeline replaces the legacy 3-pipeline architecture (question extraction → answer-key matching → explanation/taxonomy/IRT generation) with a single deterministic pipeline designed for rasterized ("Print to PDF") image-only PDFs.

### Why Deterministic?

The target question-paper PDFs are rasterized images with **no embedded text layer** (`pdffonts` confirms zero fonts). However, once processed through OCR, every question adheres to a rigid, deterministic layout:
- Questions start with `Q<N>. [Subject: <text>] [Topic: <text>] [Sub-topic: <text>] [Difficulty: <text>]`.
- Followed by the question stem (which may contain numbered statement lines).
- Four options `(A)`, `(B)`, `(C)`, `(D)`.
- Verified answer line: `Answer: (<X>) <option text>`.
- Solution header and detailed explanation paragraphs.
- Optional `Common Mistake:` callout.
- Optional `Reverse Logic Box Why the other options are wrong` with `Option (<X>): Why it seems tempting ... What's actually true ...`.

Because the answer key and explanations are embedded directly beneath each question stem, a single extraction pass captures everything deterministically without costly, non-deterministic per-page vision-LLM calls.

---

## Architecture

```
                 Rasterized Image PDF (No Fonts)
                              │
                              ▼
                 ┌──────────────────────────┐
                 │  DoclingOcrExtractor     │
                 │  (RapidOCR + Document-   │
                 │   Converter + Tables)    │
                 └────────────┬─────────────┘
                              │
                    Unified Markdown & Assets
                              │
                              ▼
                 ┌──────────────────────────┐
                 │       detect_format      │
                 └────────────┬─────────────┘
                              │
                 ┌────────────┴─────────────┐
                 │                          │
                 ▼ (EXPLAINED_QA)           ▼ (RAW_EXAM fallback)
    ┌──────────────────────────┐  ┌──────────────────────────┐
    │ split_into_question_     │  │ Standard OCR / Fallback  │
    │ blocks                   │  └──────────────────────────┘
    └────────────┬─────────────┘
                 │
                 ▼
    ┌──────────────────────────┐
    │ parse_question_block     │
    │  - Q_HEADER tags         │
    │  - Stem & statements     │
    │  - Options (A..D)        │
    │  - Verified Answer (A..D)│
    │  - Solution & Mistakes   │
    │  - Reverse Logic Box     │
    │  - Asset Disambiguation  │
    └────────────┬─────────────┘
                 │
                 ▼
    ┌──────────────────────────┐
    │ commit_question_records_ │
    │ in_batches               │
    │  - Chunked 25-q commits  │
    │  - Questions, Options    │
    │  - Explanations & Reason │
    │  - HumanReviewTask (HITL)│
    └──────────────────────────┘
```

---

## Core Components

1. **`app.pipeline.docling_ocr_extractor.DoclingOcrExtractor`**:
   - Uses Docling's `DocumentConverter` with RapidOCR enabled (`do_ocr=True`).
   - Extracts page images, table structures in Markdown, and picture bboxes.
   - Inserts explicit `<!-- PAGE_BREAK p=<N> -->` markers to enable cross-page question stitching.

2. **`app.pipeline.patterns`**:
   - Noise-tolerant, compiled regex patterns for question headers, option lines, answer lines, solution headers, common mistake blocks, and reverse logic reasoning.

3. **`app.pipeline.regex_question_parser`**:
   - `detect_format(text: str) -> str`: Detects `EXPLAINED_QA` vs `RAW_EXAM`.
   - `split_into_question_blocks(markdown: str) -> list[dict]`: Chunks markdown on question headers while preserving cross-page continuity.
   - `parse_question_block(block, pictures, tables) -> QuestionRecord`: Validates question integrity and computes extraction confidence.
   - `disambiguate_asset_question(...)`: Distinguishes whether a table/image belongs to the question stem, an option, or the explanation.

4. **`app.pipeline.batch_processor`**:
   - Persists questions, options, translations, explanations, option reasoning, and assets in chunked transactions.
   - Flags questions with missing options, missing answers, or low confidence to `HumanReviewTask` (review_status=`PENDING_REVIEW`).

5. **`app.services.pipeline_management_service`**:
   - Oversees `DOCUMENT_EXTRACTION` pipeline run lifecycle.
   - Transitions run to `COMPLETED` or `WAITING_FOR_HITL` if questions were flagged.
