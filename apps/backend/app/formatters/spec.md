# Module Specification: Standardized Formatters & Exporters (`formatters/`)

## Overview
The `formatters` module serializes Question and Passage records into standardized PYQ collection YAML files and matching Markdown files with embedded visual images.

## Filename Alignment Law
Both `.yaml` and `.md` files share the exact same canonical kebab-case filename stem generated via `get_canonical_question_filename_stem`:
- **Format**: `<exam_code>-<year>-<paper>-<question_number_3_digits>`
- **YAML File**: `upsc-cse-2026-2026-gs-1-001.yaml`
- **Markdown File**: `upsc-cse-2026-2026-gs-1-001.md`

## Exporters
1. **YAML Exporter (`formatters/yaml_exporter.py`)**:
   - `async_export_question_to_yaml_dict`: Serializes question stem, multi-choice options, correct answer, primary taxonomy tags (subject, topic, sub_topic), difficulty, estimated time, and image asset keys into the required YAML schema.
2. **Markdown Exporter (`formatters/markdown_exporter.py`)**:
   - `async_export_question_to_markdown`: Renders header, status, question stem, option list, reading passage context, and embeds diagram images (`![DIAGRAM](public_url)`).
