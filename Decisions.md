# Decisions

- Reuse `src/lib/postgres.ts` because the existing dashboard already reads Docker Postgres through a pooled `pg` connection. This keeps NLP on the same data source.
- Keep the LLM server-side because database credentials and provider keys must never reach the browser. The browser only posts a question to `/api/nlp/query`.
- Use a typed runtime validator in `src/lib/nlp-query.ts` because this repository does not currently have Zod installed. It whitelists intents, fields, filters, grouping, sorting, and limits before any database call.
- Ask the LLM for structured JSON but never SQL because language understanding is the only model responsibility. SQL remains authored by the application, with discovered identifiers and parameterized values.
- Discover columns from `information_schema` because the CSV and Prisma model establish the expenditure vocabulary, while the live database may use aliases such as `category`/`expense_category` or `name`/`employee_name`.
- Validate filter values against the database because the model must not invent plants, vendors, departments, or categories. Unknown values become a friendly error.
- Use one analytics executor for totals, comparisons, trends, employee aggregation, top expenses, and filtered records so read-only safety rules stay in one place.
- Return a compact result plus a visualization hint so the dashboard can render the answer without sending raw records to the model.
- Add `AskYourData` to the existing home page because this feature extends the current dashboard instead of creating a second dashboard system.
- Require `OPENAI_API_KEY` only on the server and allow `OPENAI_MODEL` to override the default because the project has no existing provider configuration.
