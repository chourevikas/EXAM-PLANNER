# LLM Usage and Cost Tracking

Every Gemini request the backend makes is recorded, one row per request, in the `llm_usage_events` table. Each row says which feature made the request, what it was for (exam, attempt, user), how many tokens it used, what it cost and whether it failed. Group the rows to see where the money goes.

There is no admin page for this yet. Read it with SQL (below) or, for the billed amounts, from the GCP billing export.

## What gets recorded

| Feature (`feature`) | Where it runs | What `exam_id` / `attempt_id` / `detail` hold |
|---|---|---|
| `translation` | Gemini fallback of `GoogleTranslationService` (used when Cloud Translation fails or has no credentials) | `exam_id` when translating a whole exam; `detail` = target language (`hi`, `mr`, …). Translations made on demand while a student views a question have no `exam_id`. |
| `knowledge_tagging` | `KnowledgeAIExtractor` (concepts / entities / relationships per batch of questions) | `exam_id` when enriching an exam |
| `attempt_report` | `ReportAISynthesizer` for one submitted attempt | `exam_id`, `attempt_id`, `user_id` |
| `cumulative_report` | `ReportAISynthesizer` for a student's all-exams report | `user_id` (exam and attempt are not single ids, so they are empty) |
| `unspecified` | Any new caller of `get_vision_llm()` that does not pass `feature=` | — |

### Columns

| Column | Meaning |
|---|---|
| `created_at` | When the request finished (UTC) |
| `feature`, `model` | See above; model is e.g. `gemini-2.5-flash` |
| `status`, `error` | `ok` or `error`; `error` holds the exception text. Failed requests have no token counts. |
| `exam_id`, `attempt_id`, `user_id`, `detail` | What the request was for (plain ids, not foreign keys, so rows survive deleting the exam) |
| `input_tokens` | Prompt tokens, including cached ones |
| `cached_tokens` | Part of `input_tokens` read from the context cache (billed at the cached rate) |
| `output_tokens` | Visible output only |
| `thinking_tokens` | Gemini's hidden reasoning, billed at the output rate |
| `cost_usd`, `cost_inr` | List-price cost of the request (see *How cost is calculated*) |
| `latency_ms` | Time from request to response |

## Querying the usage

Connect to the database (the URL is `DATABASE_URL` in the backend `.env`):

```bash
psql "$DATABASE_URL"
```

All queries below are PostgreSQL.

### Cost by feature

```sql
SELECT feature,
       count(*)                                   AS requests,
       count(*) FILTER (WHERE status = 'error')   AS failed,
       round(sum(cost_inr)::numeric, 2)           AS cost_inr,
       sum(input_tokens)                          AS input_tokens,
       sum(output_tokens)                         AS output_tokens,
       sum(thinking_tokens)                       AS thinking_tokens
FROM llm_usage_events
WHERE created_at >= now() - interval '30 days'
GROUP BY feature
ORDER BY cost_inr DESC;
```

### Cost per day, per feature

```sql
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS day_ist,
       feature,
       round(sum(cost_inr)::numeric, 2) AS cost_inr,
       count(*) AS requests
FROM llm_usage_events
WHERE created_at >= now() - interval '14 days'
GROUP BY 1, 2
ORDER BY 1 DESC, cost_inr DESC;
```

### How much of the cost is thinking

```sql
SELECT feature,
       round(100.0 * sum(thinking_tokens) / nullif(sum(thinking_tokens + output_tokens), 0), 1) AS thinking_pct_of_output,
       round(sum(thinking_tokens) * 2.50 / 1e6 * 95.5, 2) AS thinking_cost_inr
FROM llm_usage_events
WHERE created_at >= now() - interval '30 days'
GROUP BY feature
ORDER BY thinking_cost_inr DESC;
```

`2.50` is the gemini-2.5-flash output price (USD per 1M tokens) and `95.5` is `LLM_USD_TO_INR`; change both if the model or rate changes.

### Most expensive exams

```sql
SELECT e.exam_id, x.code, e.feature,
       count(*) AS requests,
       round(sum(e.cost_inr)::numeric, 2) AS cost_inr
FROM llm_usage_events e
LEFT JOIN exams x ON x.id = e.exam_id
WHERE e.exam_id IS NOT NULL
GROUP BY e.exam_id, x.code, e.feature
ORDER BY cost_inr DESC
LIMIT 20;
```

An exam that appears with many more requests than it has questions was probably re-extracted or re-translated several times.

### Average cost of one request, and of one report

```sql
SELECT feature,
       round(avg(cost_inr)::numeric, 4)   AS avg_inr_per_request,
       round(avg(input_tokens))           AS avg_input,
       round(avg(output_tokens))          AS avg_output,
       round(avg(thinking_tokens))        AS avg_thinking,
       round(avg(latency_ms))             AS avg_latency_ms
FROM llm_usage_events
WHERE status = 'ok' AND created_at >= now() - interval '30 days'
GROUP BY feature;
```

### Translation cost per language

```sql
SELECT detail AS language, count(*) AS requests, round(sum(cost_inr)::numeric, 2) AS cost_inr
FROM llm_usage_events
WHERE feature = 'translation'
GROUP BY detail
ORDER BY cost_inr DESC;
```

### Failures and retries

```sql
SELECT feature, date_trunc('hour', created_at) AS hour, count(*) AS failures, min(error) AS example_error
FROM llm_usage_events
WHERE status = 'error' AND created_at >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 2 DESC;
```

A request that the client retries internally is recorded once, with the outcome of its last try.

### The most expensive single requests

```sql
SELECT created_at, feature, exam_id, attempt_id, detail,
       input_tokens, output_tokens, thinking_tokens, round(cost_inr::numeric, 3) AS cost_inr
FROM llm_usage_events
ORDER BY cost_inr DESC
LIMIT 20;
```

## Cross-checking with the GCP bill

Each request is also sent to Vertex AI with the labels `feature` (same names as above) and `env` (`ENVIRONMENT` setting). Vertex AI copies these labels onto its billing records, so the invoice itself can be split by feature.

1. In the GCP console open **Billing → Billing export** and enable **Detailed usage cost** export to a BigQuery dataset. Only usage after enabling is exported, and rows can take up to a day to appear.
2. Query the export table (replace the table name with yours):

```sql
SELECT (SELECT value FROM UNNEST(labels) WHERE key = 'feature') AS feature,
       (SELECT value FROM UNNEST(labels) WHERE key = 'env')     AS env,
       ROUND(SUM(cost), 2)                                       AS cost,
       ANY_VALUE(currency)                                       AS currency
FROM `YOUR_PROJECT.YOUR_DATASET.gcp_billing_export_resource_v1_XXXXXX`
WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY feature, env
ORDER BY cost DESC;
```

Rows with no `feature` label are Gemini usage from requests made before this tracking existed, or from something outside this backend using the same project.

If the bill and `llm_usage_events` disagree by more than a few percent, check the price table and `LLM_USD_TO_INR` (below).

## How cost is calculated

`cost_usd = (input − cached) × input price + cached × cached price + (output + thinking) × output price`

List prices (USD per 1M tokens) live in `MODEL_PRICES_USD_PER_M` in `apps/backend/app/llm/usage.py`:

| Model | Input | Cached input | Output (incl. thinking) |
|---|---|---|---|
| gemini-2.5-flash | 0.30 | 0.03 | 2.50 |
| gemini-2.5-flash-lite | 0.10 | 0.01 | 0.40 |
| gemini-2.5-pro | 1.25 | 0.125 | 10.00 |

A model not in the table is costed as gemini-2.5-flash and logged as a warning; add a row when switching models. Update the table if Google changes prices (these are stored per row at the time of the request, so old rows keep their old cost).

`cost_inr = cost_usd × LLM_USD_TO_INR`. The default, 95.5, is what the September 2026 GCP invoice works out to per USD of list price (taxes included).

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `LLM_USAGE_TRACKING_ENABLED` | `true` | Set `false` to stop recording rows (billing labels are still sent) |
| `LLM_USD_TO_INR` | `95.5` | INR per USD of list price, for `cost_inr` |
| `GEMINI_MODEL_NAME` | `gemini-2.5-flash` | Model name stored on each row and used for pricing |

Recording a row never fails the request it describes; a failed write is logged as a warning (`Could not record LLM usage for feature …`).

## Adding a new LLM feature

Name the feature when building the model, and open a scope around the work so requests are tied to what they were for:

```python
from app.llm.factory import get_vision_llm
from app.llm.usage import llm_usage_scope

llm = get_vision_llm(feature="question_explanation", usage_context={"detail": "en"})

with llm_usage_scope(exam_id=exam.id):
    await llm.ainvoke(prompt)
```

- Use a short snake_case name; it becomes both the `feature` value and the billing label.
- `usage_context` is fixed for that model instance; `llm_usage_scope` applies to every request made inside the block, including in tasks started from it. Values from both are combined.
- Ids must be integers; anything else (for example `"CUMULATIVE_ALL"`) is stored as empty.

## Database migration

The table is created by `apps/backend/alembic/versions/057_llm_usage_events.py`. It currently follows `055_exam_mixed_bank` because `056_payments_cashfree` is only on the payment-gateway branch. When both branches are merged, set `down_revision = '056_payments_cashfree'` in `057_llm_usage_events.py` so the migrations form one chain.

## Code

| File | What it holds |
|---|---|
| `apps/backend/app/llm/usage.py` | Callback that records each request, cost calculation, price table, `llm_usage_scope`, billing labels |
| `apps/backend/app/llm/factory.py` | `get_vision_llm(feature=…, usage_context=…)` attaches the callback and labels |
| `apps/backend/app/db/models/llm_usage.py` | `LlmUsageEvent` model |
| `apps/backend/tests/test_llm_usage.py` | Tests for token split, cost, tagging and the stored row |
