export type ExamName = 'upsc';

export type PaperType = 'previous_year_question' | 'mock_test';

export type AdminTab = 'upload' | 'overview' | 'bank';

export interface UploadExamPayload {
  examName: string;
  year: string;
  paperType: string;
  file: File;
  exam_type?: string;
  exam_type_id?: number;
  conflict_resolution?: string;
}

export interface UploadExamResponse {
  message?: string;
  s3_path?: string;
  canonical_exam_code?: string;
  target_set_code?: string;
  detail?: string;
}

export interface StatusMessage {
  text: string;
  isError: boolean;
}

// --- Exam Session Lifecycle & Psychometric Analytics Types ---

export type AttemptMode = 'EXAM' | 'PRACTICE' | 'REVISION';

export type QuestionResponseStatus =
  | 'UNVISITED'
  | 'VISITED'
  | 'ANSWERED'
  | 'MARKED_FOR_REVIEW'
  | 'ANSWERED_AND_MARKED';

export type AttemptStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'TIMED_OUT'
  | 'ABANDONED';

export interface StartExamRequest {
  exam_id: number | string;
  mode?: AttemptMode;
  force_new?: boolean;
}

export interface SaveResponseRequest {
  question_id: number | string;
  selected_option_id?: number | string | null;
  is_marked_for_review?: boolean;
  time_spent_seconds?: number;
  option_switch_count?: number;
}

export interface BatchSaveItem {
  question_id: number | string;
  selected_option_id?: number | string | null;
  is_marked_for_review?: boolean;
  time_spent_seconds?: number;
  is_switched?: boolean;
  option_switch_count?: number;
  client_timestamp?: string;
}

export interface BatchSaveResponseRequest {
  batch_id?: string;
  responses: BatchSaveItem[];
}

export interface BatchSaveResponseAck {
  batch_id: string;
  status: string;
  received_count: number;
  response_summary?: ResponseSummary;
}

export interface BatchStatusResponse {
  batch_id: string;
  status: string;
  processed_count: number;
  error?: string | null;
  updated_at: string;
}

export interface SubmitExamRequest {
  submission_reason?: string;
  responses?: BatchSaveItem[];
}

export interface HeartbeatRequest {
  remaining_time_seconds: number;
  active_question_id?: number | string | null;
}

export interface OptionOut {
  option_id: number | string;
  option_label: string;
  text: string;
  is_correct?: boolean;
  textHindi?: string;
  text_hindi?: string;
  display_order?: number;
  translations?: Record<string, string | { option_text?: string }>;
}

export interface QuestionOut {
  question_id: number | string;
  question_number: number;
  text: string;
  textHindi?: string;
  text_hindi?: string;
  question_text_hi?: string;
  question_text_hindi?: string;
  translations?: Record<string, string | { question_text?: string; parent_context_override?: string }>;
  options: OptionOut[];
  subject?: string;
  topic?: string;
  subtopic?: string;
  topic_name?: string;
  subtopic_name?: string;
  difficulty?: string;
  marks?: number;
  negative_marks?: number;
  expected_time_seconds?: number;
  section_code?: string;
  has_image?: boolean;
  assets?: Record<string, any>[];
  passage_text?: string | null;
  passage_text_hindi?: string | null;
  passage_text_hi?: string | null;
  passage_translations?: Record<string, string>;
}

export interface NavigationMeta {
  current: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ResponseState {
  selected_option_id: number | string | null;
  is_marked_for_review: boolean;
  time_spent_seconds: number;
  question_status: QuestionResponseStatus;
  answer_revealed: boolean;
}

export interface QuestionNavResponse {
  question: QuestionOut;
  navigation: NavigationMeta;
  response_state: ResponseState;
}

export interface QuestionPaletteItem {
  question_number: number;
  question_id: number | string;
  question_status: QuestionResponseStatus;
}

export interface ResponseSummary {
  answered_count: number;
  marked_for_review_count: number;
  unattempted_count: number;
  total: number;
}

export interface StartExamResponse {
  attempt_id: number | string;
  exam_id: number | string;
  status: AttemptStatus;
  mode: AttemptMode;
  started_at: string;
  max_duration_seconds: number;
  total_questions: number;
  first_question: QuestionNavResponse;
  palette: QuestionPaletteItem[];
  questions_presigned_url?: string | null;
  questions_folder_url?: string | null;
}

export interface SaveResponseResponse {
  status: string;
  saved_at: string;
  response_summary: ResponseSummary;
}

export interface RevealAnswerResponse {
  question_id: number | string;
  question_number: number;
  correct_option_id: number | string;
  correct_option_label: string;
  is_user_correct: boolean;
  user_selected_option_id?: number | string | null;
  user_selected_label?: string | null;
  marks_awarded: number;
  closeness_score: number;
  closeness_classification: string;
  explanation: Record<string, any> | string;
  distractor_scores: Record<string, any>;
}

export interface SubmitExamResponse {
  attempt_id: number | string;
  status: AttemptStatus;
  submitted_at: string;
  submission_reason: string;
  raw_score: number;
  max_score: number;
  accuracy_percentage: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  time_taken_seconds: number;
  max_duration_seconds: number;
  evaluation_status: string;
  evaluation_message: string;
}

export interface ExamStatusResponse {
  attempt_id: number | string;
  exam_id: number | string;
  exam_name?: string;
  status: AttemptStatus;
  mode: AttemptMode;
  started_at: string;
  max_duration_seconds: number;
  remaining_seconds: number;
  current_question_index: number;
  total_questions: number;
  response_summary: ResponseSummary;
  palette: QuestionPaletteItem[];
  questions_presigned_url?: string | null;
  questions_folder_url?: string | null;
}

export interface HeartbeatResponse {
  server_time: string;
  remaining_time_seconds: number;
  status: AttemptStatus;
  auto_submitted: boolean;
  submission_summary?: SubmitExamResponse | null;
}

// --- Psychometric Diagnostics Report Types ---

export interface PerQuestionDiagnosticItem {
  question_number: number;
  meaningful_name: string;
  section_code: string;
  subject_name: string;
  topic_name: string;
  subtopic_name: string;
  blooms_taxonomy_level: string;
  user_selected_option: string;
  initial_selected_option: string;
  is_answer_correct: boolean;
  option_closeness_score: number;
  closeness_classification: string;
  time_taken_seconds: number;
  expected_time_seconds: number;
  time_pacing_window: string;
  final_points_awarded: number;
  item_guessing_probability_gti: number;
  is_option_switched: boolean;
}

export interface TaxonomyMasteryItem {
  taxonomy_type: string;
  code: string;
  name: string;
  total_attempts: number;
  correct_attempts: number;
  mastery_percentage: number;
  strength_status: string;
}

export interface ExamTimelineItem {
  attempt_number: number;
  attempt_id: number | string;
  exam_id: number | string;
  exam_name: string;
  exam_code: string;
  date: string;
  date_formatted: string;
  total_score: number;
  max_possible_score: number;
  accuracy_percentage: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  total_questions: number;
  time_taken_seconds: number;
  icrs_score: number;
  irt_theta: number;
  gti_score: number;
  oeei_score: number;
  satoi_score: number;
  pacing_status: string;
  mode?: string;
  exam_type_label?: string;
  mode_weight?: number;
}

export interface ActionableStudyTask {
  task_id: string;
  title: string;
  subject: string;
  topic: string;
  subtopic?: string;
  activity_type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  allocated_time_minutes: number;
  due_in_days: number;
  reasoning: string;
  action_checklist: string[];
  linked_question_numbers?: number[];
  is_added_to_plan?: boolean;
}

export interface CognitiveDiagnosticInsight {
  executive_summary: string;
  benchmark_verdict: string;
  tactical_strengths: string[];
  critical_vulnerabilities: string[];
  pacing_and_unattempted_diagnosis: string;
  distractor_trap_critique: string;
  study_plan_tasks: ActionableStudyTask[];
  closing_mentorship_advice: string;
}

export interface ModalityAggregateSummary {
  count: number;
  icrs_score: number;
  irt_theta: number;
  gti_score: number;
  oeei_score: number;
  satoi_score: number;
  accuracy_percentage: number;
  total_questions_attempted: number;
  total_score: number;
  total_max_score?: number;
}

export interface SegregatedAggregates {
  all_exams: ModalityAggregateSummary;
  full_mock_exams: ModalityAggregateSummary;
  practice_tests: ModalityAggregateSummary;
  guest_trials: ModalityAggregateSummary;
  modality_weights: Record<string, number>;
}

export interface PsychometricReport {
  is_cumulative?: boolean;
  exam_timeline?: ExamTimelineItem[];
  segregated_aggregates?: SegregatedAggregates;
  llm_insight?: CognitiveDiagnosticInsight;
  evolution_graphs?: {
    labels: string[];
    dates: string[];
    scores: number[];
    max_scores: number[];
    accuracies: number[];
    icrs_scores: number[];
    irt_thetas: number[];
    gti_percentages: number[];
    oeei_percentages: number[];
    satoi_scores: number[];
  };
  metadata: {
    report_title: string;
    report_type?: string;
    total_exams_evaluated?: number;
    total_questions_attempted?: number;
    total_correct?: number;
    total_incorrect?: number;
    total_unattempted?: number;
    cumulative_accuracy_percentage?: number;
    generated_at: string;
    candidate: {
      user_id: number | string;
      full_name: string;
      email: string;
    };
    exam_attempt: {
      attempt_id?: number | string;
      exam_id?: number | string;
      exam_name: string;
      canonical_code: string;
      total_score_awarded?: number;
      total_score?: number;
      max_possible_score: number;
      time_spent_seconds: number;
      total_questions_attempted?: number;
      attempt_date: string;
    };
  };
  user_overall_skill_profile: {
    meaningful_name: string;
    description: string;
    cumulative_icrs_score: number;
    cumulative_irt_theta: number;
    cumulative_gti: number;
    cumulative_oeei: number;
    cumulative_satoi: number;
    total_tests_given: number;
    total_questions_answered: number;
    taxonomy_mastery_breakdown: TaxonomyMasteryItem[];
  };
  exam_macro_analytics: {
    '1_integrated_cognitive_readiness': {
      meaningful_name: string;
      description: string;
      value: {
        icrs_score: number;
        classification: string;
        interpretation: string;
      };
    };
    '2_irt_3pl_latent_ability': {
      meaningful_name: string;
      description: string;
      value: {
        latent_ability_theta: number;
        percentile_estimate: number;
        standard_error: number;
      };
    };
    '3_guessing_tendency_index': {
      meaningful_name: string;
      description: string;
      value: {
        aggregate_gti: number;
        category: string;
        label: string;
        recommendation: string;
      };
    };
    '4_macro_pacing_and_fatigue': {
      meaningful_name: string;
      description: string;
      value: {
        time_utilization_pct: number;
        skew_ratio: number;
        pacing_classification: string;
      };
    };
    '5_option_elimination_efficiency': {
      meaningful_name: string;
      description: string;
      value: {
        oeei_score: number;
        elimination_efficiency_rating: string;
      };
    };
    '6_speed_accuracy_tradeoff_satoi': {
      meaningful_name: string;
      description: string;
      value: {
        satoi_score: number;
        burnout_risk: string;
        quartile_accuracies?: number[];
      };
    };
    '7_option_switch_regret': {
      meaningful_name: string;
      description: string;
      value: {
        switch_frequency: number;
        regret_ratio: number;
        recommendation: string;
      };
    };
    '8_blooms_taxonomy_mastery': {
      meaningful_name: string;
      description: string;
      value: Record<string, number>;
    };
    '9_topic_fsrs_memory_decay': {
      meaningful_name: string;
      description: string;
      value: {
        topic_decay_records: Array<{
          topic_name: string;
          retrievability: number;
          recommended_revision_date: string;
        }>;
      };
    };
    '10_option_closeness_classification': {
      meaningful_name: string;
      description: string;
      value: Record<string, number>;
    };
  };
  per_question_diagnostic_report: PerQuestionDiagnosticItem[];
}

export interface QuestionReportExplanation {
  core_concept?: string;
  detailed_solution?: string;
  common_traps?: string[] | string | any;
  key_takeaways?: string[] | string | any;
}

export interface QuestionReportItem {
  question_id: number | string;
  question_number: number;
  question_text?: string;
  subject_name?: string;
  topic_name?: string;
  difficulty?: string;
  options?: Array<{
    option_id: number | string;
    option_label: string;
    text: string;
    is_correct?: boolean;
  }>;
  selected_option_id?: number | string | null;
  selected_option_label?: string | null;
  correct_option_id?: number | string;
  correct_option_label?: string;
  is_correct: boolean;
  final_score: number;
  time_taken_seconds: number;
  expected_time_seconds: number;
  time_window?: string;
  closeness_score?: number;
  closeness_classification?: string;
  blooms_level?: string;
  gti_item_score?: number;
  is_option_switched?: boolean;
  explanation?: QuestionReportExplanation | null;
}

export interface UserProgressionReportData {
  attempt_id: number | string;
  user_id: number | string;
  previous_metrics: {
    cumulative_icrs: number;
    cumulative_irt_theta: number;
    cumulative_gti: number;
    cumulative_oeei: number;
    cumulative_satoi: number;
    total_tests_given: number;
    total_questions_answered: number;
  };
  updated_metrics: {
    cumulative_icrs: number;
    cumulative_irt_theta: number;
    cumulative_gti: number;
    cumulative_oeei: number;
    cumulative_satoi: number;
    total_tests_given: number;
    total_questions_answered: number;
  };
  deltas: {
    icrs_delta: number;
    irt_theta_delta: number;
    gti_delta: number;
    oeei_delta: number;
    satoi_delta: number;
  };
  taxonomy_promotions?: any;
  spaced_repetition_schedule?: any;
}

export interface AttemptEvaluationStatus {
  attempt_id: number | string;
  status: string;
  is_ready: boolean;
  progress_percentage: number;
  message: string;
  submitted_at?: string | null;
  raw_score?: number;
  total_questions?: number;
}



