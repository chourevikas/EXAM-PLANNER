# Complete Technical Manual: All 25 Database Schemas & Index Audit
> **Exam Mentorship Platform & Vision AI PDF Question Extraction Engine**
> Connection String (PostgreSQL): `DATABASE_URL="postgresql+asyncpg://exam_user:exam_password@localhost:5432/exam_platform_db"`

> [!NOTE]
> **INDEX INTEGRITY CONFIRMATION**: No indexes have been removed from the database! Every single primary key index, foreign key index, single-column B-Tree index, and composite multi-column index across all 25 tables is 100% intact and enforced in the SQLModel definitions.

---

## 1. Complete Index Audit Master Table (All 25 Tables)

Below is the exhaustive, audit-grade list of every single index configured across all 25 database tables.

| # | Table Name | Index Name | Columns Indexed | Type | Performance & Query Optimization Purpose |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **1** | `users` | `users_pkey` | `(id)` | PK | Instant primary key lookup. |
| | | `ix_users_email` | `(email)` | Unique | Instant login & user authentication lookup. |
| | | `ix_users_full_name` | `(full_name)` | B-Tree | Student search by name in mentor portal. |
| | | `ix_users_role` | `(role)` | B-Tree | Role-based authorization checks. |
| | | `ix_users_status` | `(status)` | B-Tree | Active user status filtering. |
| | | `ix_users_role_status` | `(role, status)` | Composite | Accelerates fetching active students or admins. |
| **2** | `platform_features` | `platform_features_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_platform_features_code` | `(feature_code)` | Unique | Machine-readable permission check lookup. |
| | | `ix_platform_features_is_active`| `(is_active)` | B-Tree | Filtering active features platform-wide. |
| **3** | `subscription_plans` | `subscription_plans_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_subscription_plans_code` | `(plan_code)` | Unique | Plan lookup by code (`PRO_MENTORSHIP`). |
| | | `ix_subscription_plans_interval`| `(billing_interval)` | B-Tree | Monthly vs yearly plan filtering. |
| | | `ix_subscription_plans_active_display` | `(is_active, display_order)` | Composite | Accelerates sorting active plans on UI pricing page. |
| **4** | `plan_feature_links` | `plan_feature_links_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_plan_feature_unique` | `(plan_id, feature_id)` | Unique | Guarantees duplicate feature links cannot exist. |
| **5** | `user_subscriptions` | `user_subscriptions_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_user_subs_user_id` | `(user_id)` | B-Tree | FK lookup. |
| | | `ix_user_subs_plan_id` | `(plan_id)` | B-Tree | FK lookup. |
| | | `ix_user_subs_status` | `(status)` | B-Tree | Active subscription status. |
| | | `ix_user_subs_user_status` | `(user_id, status)` | Composite | Ultra-fast access authorization check during requests. |
| | | `ix_user_subs_period_end` | `(current_period_end)` | B-Tree | Enables daily expiration cron jobs. |
| | | `ix_user_subs_gateway_id` | `(gateway_subscription_id)` | B-Tree | Payment webhook callback lookup. |
| **6** | `exams` | `exams_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_exams_code` | `(code)` | Unique | Canonical 5-token code lookup (`upsc_cse-prelims-gs1-2023-A`). |
| | | `ix_exams_stage` | `(stage)` | B-Tree | Filter exams by stage (`prelims`). |
| | | `ix_exams_subject_code` | `(subject_code)` | B-Tree | Filter exams by subject (`gs1`). |
| | | `ix_exams_source_year` | `(source_year)` | B-Tree | Filter exams by year (`2023`). |
| | | `ix_exams_paper_set_code` | `(paper_set_code)` | B-Tree | Filter exams by set code (`SET_A`). |
| | | `ix_exams_is_active` | `(is_active)` | B-Tree | Filter active exams. |
| | | `ix_exams_active_order` | `(is_active, display_order)` | Composite | Fast sorted listing of active exams. |
| | | `ix_exams_canonical_match` | `(stage, subject_code, source_year, paper_set_code)` | Composite | **Crucial for Answer Key matching across all sets!** |
| **7** | `syllabus_versions` | `syllabus_versions_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_syllabus_exam_id` | `(exam_id)` | B-Tree | FK lookup. |
| | | `ix_syllabus_is_active` | `(is_active)` | B-Tree | Active syllabus filter. |
| | | `ix_syllabus_exam_version` | `(exam_id, version_code)` | Unique | Unique revision version per exam. |
| **8** | `subjects` | `subjects_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_subjects_syllabus_id` | `(syllabus_version_id)`| B-Tree | FK lookup. |
| | | `ix_subjects_syllabus_order` | `(syllabus_version_id, display_order)` | Composite | Sorted subject listing within syllabus. |
| **9** | `topics` | `topics_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_topics_subject_id` | `(subject_id)` | B-Tree | FK lookup. |
| | | `ix_topics_subject_order` | `(subject_id, display_order)` | Composite | Sorted topic listing within subject. |
| **10** | `subtopics` | `subtopics_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_subtopics_topic_id` | `(topic_id)` | B-Tree | FK lookup. |
| | | `ix_subtopics_topic_order` | `(topic_id, display_order)` | Composite | Sorted subtopic listing within topic. |
| **11** | `passages` | `passages_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_passages_subtopic_id` | `(subtopic_id)` | B-Tree | FK lookup. |
| | | `ix_passages_exam_id` | `(exam_id)` | B-Tree | FK lookup. |
| | | `ix_passages_section_code` | `(section_code)` | B-Tree | Paper section lookup. |
| | | `ix_passages_memory_type` | `(memory_type)` | B-Tree | Passage vs Case Study filter. |
| | | `ix_passages_is_complete` | `(is_complete)` | B-Tree | Completeness status filter. |
| | | `ix_passages_exam_section` | `(exam_id, section_code)`| Composite | Rapid passage fetching for exam sections. |
| **12** | `passage_translations` | `passage_translations_pkey`| `(id)` | PK | Primary Key. |
| | | `ix_passage_trans_passage_id`| `(passage_id)` | B-Tree | FK lookup. |
| | | `ix_passage_trans_language` | `(language)` | B-Tree | Language code filter. |
| | | `ix_passage_trans_unique` | `(passage_id, language)`| Unique | One translation per language per passage. |
| **13** | `questions` | `questions_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_questions_exam_id` | `(exam_id)` | B-Tree | FK lookup. |
| | | `ix_questions_subtopic_id` | `(subtopic_id)` | B-Tree | FK lookup. |
| | | `ix_questions_passage_id` | `(passage_id)` | B-Tree | FK lookup. |
| | | `ix_questions_section_code` | `(section_code)` | B-Tree | Paper section filter. |
| | | `ix_questions_paper_set_code`| `(paper_set_code)` | B-Tree | Question set filter (`SET_A`). |
| | | `ix_questions_q_number` | `(question_number_in_paper)`| B-Tree | Question number filter. |
| | | `ix_questions_difficulty` | `(difficulty)` | B-Tree | Difficulty level filter. |
| | | `ix_questions_source_type` | `(source_type)` | B-Tree | PYQ vs Mock filter. |
| | | `ix_questions_source_year` | `(source_year)` | B-Tree | Year filter. |
| | | `ix_questions_status` | `(status)` | B-Tree | Admin QA status filter. |
| | | `ix_questions_is_complete` | `(is_complete)` | B-Tree | Question completeness filter. |
| | | `ix_questions_has_image` | `(has_image)` | B-Tree | Diagram presence filter. |
| | | `ix_questions_exam_number` | `(exam_id, question_number_in_paper)` | Unique | **Prevents duplicate question numbers in same exam!** |
| | | `ix_questions_status_exam` | `(status, exam_id)` | Composite | Accelerates Admin QA queue loading per exam. |
| **14** | `question_translations` | `question_translations_pkey`| `(id)` | PK | Primary Key. |
| | | `ix_q_trans_question_id` | `(question_id)` | B-Tree | FK lookup. |
| | | `ix_q_trans_language` | `(language)` | B-Tree | Language code filter. |
| | | `ix_q_trans_unique` | `(question_id, language)`| Unique | One translation per language per question. |
| **15** | `question_options` | `question_options_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_options_question_id` | `(question_id)` | B-Tree | FK lookup. |
| | | `ix_options_is_correct` | `(is_correct)` | B-Tree | Answer key filter. |
| | | `ix_options_is_complete` | `(is_complete)` | B-Tree | Option completeness filter. |
| | | `ix_options_question_label`| `(question_id, option_label)` | Unique | Guarantees single option 'A', 'B', 'C', 'D' per question. |
| | | `ix_options_question_order`| `(question_id, display_order)`| Composite | Sorted option listing. |
| **16** | `option_translations` | `option_translations_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_opt_trans_option_id` | `(option_id)` | B-Tree | FK lookup. |
| | | `ix_opt_trans_language` | `(language)` | B-Tree | Language code filter. |
| | | `ix_opt_trans_unique` | `(option_id, language)`| Unique | One translation per language per option. |
| **17** | `question_assets` | `question_assets_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_assets_question_id` | `(question_id)` | B-Tree | FK lookup. |
| | | `ix_assets_asset_type` | `(asset_type)` | B-Tree | Diagram vs map filter. |
| | | `ix_assets_question_order` | `(question_id, display_order)`| Composite | Sorted asset listing. |
| **18** | `question_metadata` | `question_metadata_pkey` | `(id)` | PK | Primary Key. |
| | | `question_id` | `(question_id)` | Unique | 1-to-1 unique foreign key. |
| | | `ix_q_meta_blooms` | `(blooms_level)` | B-Tree | Bloom's taxonomy filter. |
| | | `ix_q_meta_concept` | `(primary_concept_tag)` | B-Tree | Concept tag filter. |
| **19** | `human_review_tasks` | `human_review_tasks_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_review_tasks_question_id`| `(question_id)` | B-Tree | FK lookup. |
| | | `ix_review_tasks_exam_id` | `(exam_id)` | B-Tree | FK lookup. |
| | | `ix_review_tasks_status` | `(review_status)` | B-Tree | Audit status filter. |
| | | `ix_review_tasks_flagged_v` | `(is_flagged_by_validator)`| B-Tree | Flagged audit filter. |
| | | `ix_review_tasks_status_exam`| `(review_status, exam_id)`| Composite | Fast pending review listing per exam. |
| | | `ix_review_tasks_flagged` | `(is_flagged_by_validator, review_status)` | Composite | Fast audit review filtering. |
| **20** | `answer_key_batches` | `answer_key_batches_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_ak_batch_exam_id` | `(exam_id)` | B-Tree | FK lookup. |
| | | `ix_ak_batch_target_set` | `(target_set_code)` | B-Tree | Target set filter. |
| | | `ix_ak_batch_detected_set`| `(detected_set_code)` | B-Tree | Detected set filter. |
| | | `ix_ak_batch_set_status` | `(set_match_status)` | B-Tree | Match status filter. |
| | | `ix_ak_batch_exam_status` | `(exam_id, set_match_status)`| Composite | Batch status lookup per exam. |
| **21** | `answer_key_mappings` | `answer_key_mappings_pkey`| `(id)` | PK | Primary Key. |
| | | `ix_ak_mapping_batch_id` | `(batch_id)` | B-Tree | FK lookup. |
| | | `ix_ak_mapping_q_id` | `(question_id)` | B-Tree | FK lookup. |
| | | `ix_ak_mapping_q_num` | `(printed_question_number)`| B-Tree | Question number lookup. |
| | | `ix_ak_mapping_set` | `(paper_set_code)` | B-Tree | Set code lookup. |
| | | `ix_ak_mapping_status` | `(mapping_status)` | B-Tree | Applied vs skipped status filter. |
| | | `ix_ak_mapping_batch_q` | `(batch_id, question_id)` | Composite | Audit entry lookup per batch. |
| **22** | `tests` | `tests_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_tests_test_type` | `(test_type)` | B-Tree | Mock test type filter. |
| | | `ix_tests_type_created` | `(test_type, created_at)`| Composite | Sorted mock test listing. |
| **23** | `test_questions` | `test_questions_pkey` | `(test_id, question_id)`| Composite PK | Unique test-to-question pairing. |
| | | `ix_test_q_order` | `(test_id, question_order)`| Composite | Ordered question listing in test. |
| **24** | `user_test_attempts` | `user_test_attempts_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_attempts_user_id` | `(user_id)` | B-Tree | FK lookup. |
| | | `ix_attempts_test_id` | `(test_id)` | B-Tree | FK lookup. |
| | | `ix_attempts_status` | `(status)` | B-Tree | In-progress vs submitted status. |
| | | `ix_attempts_user_status` | `(user_id, status)` | Composite | Active test attempt lookup. |
| **25** | `user_question_responses` | `user_question_responses_pkey` | `(id)` | PK | Primary Key. |
| | | `ix_responses_attempt_id` | `(attempt_id)` | B-Tree | FK lookup. |
| | | `ix_responses_question_id`| `(question_id)` | B-Tree | FK lookup. |
| | | `ix_responses_selected_opt`| `(selected_option_id)`| B-Tree | Selected option lookup. |
| | | `ix_responses_attempt_q` | `(attempt_id, question_id)`| Unique | One response per question per attempt. |
| **26** | `question_switch_logs` | `question_switch_logs_pkey`| `(id)` | PK | Primary Key. |
| | | `ix_switch_logs_response_id`| `(response_id)` | B-Tree | FK lookup. |
| **27** | `user_concept_retention`| `user_concept_retention_pkey`| `(id)` | PK | Primary Key. |
| | | `ix_retention_user_id` | `(user_id)` | B-Tree | FK lookup. |
| | | `ix_retention_subtopic_id` | `(subtopic_id)` | B-Tree | FK lookup. |
| | | `ix_retention_user_subtopic`| `(user_id, subtopic_id)`| Unique | One retention record per concept per user. |
| | | `ix_retention_next_review` | `(user_id, next_scheduled_review)`| Composite | Spaced repetition daily queue query. |

---

## 2. Summary & Index Guarantee

All **100+ single and composite indexes** across the database models are active, fully enforced, and verified.
