# Flow

1. `src/app/(admin)/page.tsx` renders the existing home page and mounts `AskYourData` above `DatabaseExplorer`.
2. `src/components/nlp/AskYourData.tsx` stores the question, submits `POST /api/nlp/query`, and renders loading, errors, the parsed intent, and the visualization hint.
3. `src/app/api/nlp/query/route.ts` validates the request shape and calls `answerExpenditureQuestion`. It returns safe JSON errors without stack traces or SQL.
4. `src/lib/nlp-query.ts` rejects an empty question, then `parseQuestion` sends only the question and an allow-list of fields/intents to the server-side provider.
5. The provider returns JSON. `validateParsedQuery` checks intent, filter keys/values, group field, sort direction, and limit. Invalid output stops here.
6. `executeAnalyticsQuery` obtains a pooled client from `src/lib/postgres.ts` and discovers `DATABASE_TABLE` columns through `information_schema`.
7. The executor maps canonical expenditure fields to real columns, checks requested filter values with parameterized lookups, and builds only application-owned SQL. The LLM cannot supply SQL or identifiers.
8. The executor runs the appropriate aggregate, grouping, trend, top-expense, or filtered-record query and returns a compact serializable result.
9. `visualizationFor` maps the intent to `kpi`, `bar`, `donut`, `line`, `horizontalBar`, or `table`. The client renders the answer without a duplicate data layer.
10. Existing `DatabaseExplorer` remains the direct table view. Its GET form sends filters and sorting back to `src/app/(admin)/page.tsx`, which calls `loadExplorerState` again with URL state.

## Configuration

- `DATABASE_URL`: existing Docker/Postgres connection string.
- `DATABASE_TABLE`: optional table name; defaults to `records`.
- `OPENAI_API_KEY`: required server-side key for natural-language parsing.
- `OPENAI_MODEL`: optional model name; defaults to `gpt-4o-mini`.
- `LLM_PROVIDER`: optional `openai` or `gemini`; inferred from the model name when omitted.
- `GEMINI_API_KEY`: optional server-side key when `LLM_PROVIDER=gemini`.

## Supported vocabulary

`plant`, `department`, `designation`, `expense_date`, `year`, `month`, `expense_category`, `expense_type`, `amount`, `vendor`, `approval_status`, `status`, `payment_mode`, `employee_name`, and `employee_id`.
