import { getPool, isSafeIdentifier } from "@/lib/postgres";
import type { PoolClient } from "pg";

export const NLP_FIELDS = [
  "plant",
  "department",
  "designation",
  "expense_date",
  "year",
  "month",
  "expense_category",
  "expense_type",
  "amount",
  "vendor",
  "approval_status",
  "status",
  "payment_mode",
  "employee_name",
  "employee_id",
] as const;

export type NlpField = (typeof NLP_FIELDS)[number];
export type NlpIntent =
  | "total_expense"
  | "average_expense"
  | "highest_expense"
  | "lowest_expense"
  | "comparison"
  | "monthly_trend"
  | "employee_expense"
  | "top_expenses"
  | "filter_records";

export type ParsedNlpQuery = {
  intent: NlpIntent;
  filters: Partial<Record<NlpField, string | number>>;
  groupBy?: NlpField;
  sort?: "asc" | "desc";
  limit?: number;
};

export type NlpResponse = {
  parsedQuery: ParsedNlpQuery;
  result: { columns: string[]; rows: Array<Record<string, string | number | null>>; total?: number };
  visualization: { type: "bar" | "donut" | "line" | "horizontalBar" | "table" | "kpi" };
  explanation: string;
};

type QueryValue = string | number;
type ColumnMap = Partial<Record<NlpField, string>>;

const INTENTS: NlpIntent[] = [
  "total_expense",
  "average_expense",
  "highest_expense",
  "lowest_expense",
  "comparison",
  "monthly_trend",
  "employee_expense",
  "top_expenses",
  "filter_records",
];

const GROUP_FIELDS: NlpField[] = [
  "plant",
  "department",
  "designation",
  "month",
  "expense_category",
  "expense_type",
  "vendor",
  "approval_status",
  "status",
  "payment_mode",
  "employee_name",
];

function quoteIdentifier(identifier: string) {
  if (!isSafeIdentifier(identifier)) throw new Error("The configured database identifier is invalid.");
  return `"${identifier}"`;
}

const INTENT_ALIASES: Record<string, NlpIntent> = {
  total: "total_expense",
  sum: "total_expense",
  total_expense: "total_expense",
  total_expenses: "total_expense",
  average: "average_expense",
  avg: "average_expense",
  mean: "average_expense",
  average_expense: "average_expense",
  highest: "highest_expense",
  max: "highest_expense",
  maximum: "highest_expense",
  highest_expense: "highest_expense",
  lowest: "lowest_expense",
  min: "lowest_expense",
  minimum: "lowest_expense",
  lowest_expense: "lowest_expense",
  comparison: "comparison",
  compare: "comparison",
  trend: "monthly_trend",
  monthly_trend: "monthly_trend",
  employee: "employee_expense",
  employee_expense: "employee_expense",
  top: "top_expenses",
  top_expenses: "top_expenses",
  filter: "filter_records",
  filter_records: "filter_records",
  records: "filter_records",
};

const FIELD_ALIASES: Record<string, NlpField> = {
  plant: "plant",
  location: "plant",
  department: "department",
  dept: "department",
  designation: "designation",
  role: "designation",
  expense_date: "expense_date",
  date: "expense_date",
  year: "year",
  month: "month",
  expense_category: "expense_category",
  category: "expense_category",
  expense_type: "expense_type",
  type: "expense_type",
  amount: "amount",
  cost: "amount",
  expenditure: "amount",
  vendor: "vendor",
  approval_status: "approval_status",
  approval: "approval_status",
  status: "status",
  payment_mode: "payment_mode",
  payment_method: "payment_mode",
  mode: "payment_mode",
  employee_name: "employee_name",
  name: "employee_name",
  employee_id: "employee_id",
};

const PLANT_ALIASES: Record<string, string> = {
  bokaro: "Plant A",
  bhilai: "Plant B",
  rourkela: "Plant C",
  durgapur: "Plant D",
  burnpur: "Plant A",
  salem: "Plant B",
};

export function validateParsedQuery(value: unknown): ParsedNlpQuery {
  if (!value || typeof value !== "object") throw new Error("The language model returned an invalid query.");
  const input = value as Record<string, unknown>;

  const rawIntent = typeof input.intent === "string" ? input.intent.trim().toLowerCase() : "";
  const intent = INTENT_ALIASES[rawIntent];
  if (!intent || !INTENTS.includes(intent)) throw new Error("That question is not supported yet.");

  const filters: Partial<Record<NlpField, QueryValue>> = {};
  const filterCandidates: Record<string, unknown> = {
    ...(typeof input.filters === "object" && input.filters !== null ? (input.filters as Record<string, unknown>) : {}),
  };

  for (const [key, val] of Object.entries(input)) {
    if (key !== "intent" && key !== "filters" && key !== "groupBy" && key !== "sort" && key !== "limit" && key !== "explanation") {
      if (filterCandidates[key] === undefined && val !== null && val !== undefined) {
        filterCandidates[key] = val;
      }
    }
  }

  for (const [rawKey, rawVal] of Object.entries(filterCandidates)) {
    if (rawVal === null || rawVal === undefined) continue;
    const normalizedKey = FIELD_ALIASES[rawKey.toLowerCase()];
    if (!normalizedKey || !(NLP_FIELDS as readonly string[]).includes(normalizedKey)) continue;

    if (typeof rawVal !== "string" && typeof rawVal !== "number") continue;
    if (typeof rawVal === "string" && rawVal.trim() === "") continue;

    filters[normalizedKey] = typeof rawVal === "string" ? rawVal.trim() : rawVal;
  }

  let rawGroupBy: unknown = input.groupBy;
  if (Array.isArray(rawGroupBy)) {
    rawGroupBy = rawGroupBy.length > 0 ? rawGroupBy[0] : undefined;
  }
  let groupBy: NlpField | undefined = undefined;
  if (typeof rawGroupBy === "string" && rawGroupBy.trim()) {
    const mapped = FIELD_ALIASES[rawGroupBy.trim().toLowerCase()];
    if (mapped && GROUP_FIELDS.includes(mapped)) {
      groupBy = mapped;
    }
  }

  let limit = 10;
  if (input.limit !== undefined && input.limit !== null) {
    const parsedLimit = Number(input.limit);
    if (Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 50) {
      limit = parsedLimit;
    }
  }

  const sort = input.sort === "asc" ? "asc" : "desc";
  return { intent, filters, groupBy, sort, limit };
}

async function parseQuestion(question: string): Promise<ParsedNlpQuery> {
  const configuredModel =
    process.env.LLM_PROVIDER === "gemini"
      ? process.env.GEMINI_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-3.6-flash"
      : process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const provider = process.env.LLM_PROVIDER ?? (configuredModel.toLowerCase().includes("gemini") ? "gemini" : "openai");
  const apiKey = provider === "gemini" ? process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`Natural-language queries are not configured. Set ${provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} on the server.`);

  const instruction = `You translate expenditure and expense questions into a structured JSON query. Never write SQL.
Allowed intents: ${INTENTS.join(", ")}.
Allowed filter fields: ${NLP_FIELDS.join(", ")}.
Allowed groupBy fields: ${GROUP_FIELDS.join(", ")}.

Output Format:
{
  "intent": "total_expense",
  "filters": {
    "plant": "Bokaro",
    "expense_category": "Travel",
    "year": 2025
  },
  "groupBy": null,
  "sort": "desc",
  "limit": 10
}

Rules:
- For totals/sum questions ("Total travel...", "How much was spent..."), use intent "total_expense".
- For averages, use "average_expense". For highest, use "highest_expense". For lowest, use "lowest_expense".
- For trend over time, use "monthly_trend". For comparison across groups, use "comparison".
- Only include filters explicitly specified in the question.
- If no grouping is needed, use null for groupBy.
- Return valid JSON only.`;

  const response = provider === "gemini"
    ? await requestGemini(instruction, question, apiKey, configuredModel)
    : await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: configuredModel, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: instruction }, { role: "user", content: question }] }),
      });
  if (!response || !response.ok) throw new Error(providerErrorMessage(provider, response?.status ?? 503));
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = provider === "gemini" ? payload.candidates?.[0]?.content?.parts?.[0]?.text : payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The language model returned no query.");
  try {
    const cleanJson = content.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    return validateParsedQuery(JSON.parse(cleanJson));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The language model returned invalid JSON.");
  }
}

async function requestGemini(instruction: string, question: string, apiKey: string, configuredModel: string) {
  const normalized = normaliseGeminiModel(configuredModel);
  const models = [
    normalized,
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ];
  let lastResponse: Response | undefined;
  for (const model of [...new Set(models)]) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${instruction}\n\nQuestion: ${question}` }] }], generationConfig: { responseMimeType: "application/json" } }),
        });
        if (response.ok) return response;
        lastResponse = response;
        if (response.status === 401 || response.status === 403) return response;
        if (attempt === 0 && (response.status === 429 || response.status === 500 || response.status === 503)) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        } else {
          break;
        }
      } catch {
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }
  return lastResponse;
}

function normaliseGeminiModel(configuredModel: string) {
  const model = configuredModel.trim().toLowerCase().replace(/\s+/g, "-");
  return model.startsWith("gemini-") ? model : "gemini-3.6-flash";
}

function providerErrorMessage(provider: string, status: number) {
  if (status === 401 || status === 403) return `${provider === "gemini" ? "Gemini" : "OpenAI"} authentication failed. Check the server-side API key.`;
  if (status === 404) return `The configured ${provider === "gemini" ? "Gemini" : "OpenAI"} model was not found. Set a valid model ID in OPENAI_MODEL.`;
  return `${provider === "gemini" ? "Gemini" : "OpenAI"} could not process that question (HTTP ${status}).`;
}

async function discoverColumns(client: PoolClient) {
  const tableName = process.env.DATABASE_TABLE ?? "records";
  if (!isSafeIdentifier(tableName)) throw new Error("DATABASE_TABLE contains an invalid identifier.");
  const result = await client.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [tableName],
  );
  if (result.rows.length === 0) throw new Error(`The configured table '${tableName}' was not found.`);
  const available = new Set(result.rows.map((row) => row.column_name));
  const aliases: Partial<Record<NlpField, string[]>> = {
    approval_status: ["approval_status", "approvalStatus", "status"],
    expense_category: ["expense_category", "category"],
    employee_name: ["employee_name", "name"],
    plant: ["plant", "location", "plant_name"],
  };
  const columnMap: ColumnMap = {};
  for (const field of NLP_FIELDS) {
    const candidates = aliases[field] ?? [field];
    const match = candidates.find((candidate) => available.has(candidate));
    if (match) columnMap[field] = match;
  }
  if (!columnMap.amount) throw new Error("The expenditure table does not contain an amount column.");
  return { tableName, columnMap };
}

export function visualizationFor(query: ParsedNlpQuery): NlpResponse["visualization"] {
  if (!query.groupBy && (query.intent === "total_expense" || query.intent === "average_expense" || query.intent === "highest_expense" || query.intent === "lowest_expense")) return { type: "kpi" };
  if (query.intent === "monthly_trend") return { type: "line" };
  if (query.intent === "employee_expense" || query.intent === "top_expenses") return { type: "horizontalBar" };
  if (query.intent === "comparison" || query.groupBy) return { type: query.groupBy === "expense_category" ? "donut" : "bar" };
  return { type: "table" };
}

export function formatCurrencyINR(amount: number): string {
  if (Math.abs(amount) >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

async function executeAnalyticsQuery(query: ParsedNlpQuery): Promise<NlpResponse["result"]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { tableName, columnMap } = await discoverColumns(client);
    const amount = quoteIdentifier(columnMap.amount!);
    const values: QueryValue[] = [];
    const where: string[] = [];

    const resolvedFilters: Partial<Record<NlpField, QueryValue>> = {};

    for (const [field, raw] of Object.entries(query.filters)) {
      const column = columnMap[field as NlpField];
      if (!column) throw new Error(`This database does not contain a '${field}' field.`);

      const strRaw = String(raw).trim();
      const check = await client.query<{ val: string | number }>(
        `select "${column}" as val from ${quoteIdentifier(tableName)} where "${column}"::text ilike $1 limit 1`,
        [strRaw],
      );

      if (check.rows.length > 0) {
        resolvedFilters[field as NlpField] = strRaw;
      } else if (field === "plant" && PLANT_ALIASES[strRaw.toLowerCase()]) {
        const aliasTarget = PLANT_ALIASES[strRaw.toLowerCase()];
        const aliasCheck = await client.query<{ val: string | number }>(
          `select "${column}" as val from ${quoteIdentifier(tableName)} where "${column}"::text ilike $1 limit 1`,
          [aliasTarget],
        );
        if (aliasCheck.rows.length > 0) {
          resolvedFilters[field as NlpField] = aliasTarget;
        } else {
          throw new Error(`No records were found for plant '${raw}'.`);
        }
      } else {
        throw new Error(`No records were found for ${field.replaceAll("_", " ")} '${raw}'.`);
      }
    }

    for (const [field, val] of Object.entries(resolvedFilters)) {
      const column = columnMap[field as NlpField]!;
      values.push(val);
      if (typeof val === "number" || field === "year" || field === "amount") {
        where.push(`${quoteIdentifier(column)} = $${values.length}`);
      } else {
        where.push(`LOWER(${quoteIdentifier(column)}::text) = LOWER($${values.length})`);
      }
    }

    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const table = quoteIdentifier(tableName);
    const groupColumn = query.groupBy ? columnMap[query.groupBy] : undefined;
    if (query.groupBy && !groupColumn) throw new Error(`This database does not contain a '${query.groupBy}' field.`);
    const order = query.sort === "asc" ? "asc" : "desc";
    if (!query.groupBy && ["total_expense", "average_expense", "highest_expense", "lowest_expense"].includes(query.intent)) {
      const aggregate = query.intent === "total_expense" ? `sum(${amount})` : query.intent === "average_expense" ? `avg(${amount})` : query.intent === "highest_expense" ? `max(${amount})` : `min(${amount})`;
      const result = await client.query<{ value: string | null }>(`select ${aggregate}::text as value from ${table} ${whereSql}`, values);
      return { columns: ["value"], rows: [{ value: result.rows[0]?.value ? Number(result.rows[0].value) : 0 }] };
    }
    if (query.intent === "filter_records") {
      const result = await client.query<Record<string, string | number | null>>(`select * from ${table} ${whereSql} order by ${amount} desc limit ${query.limit}`, values);
      return { columns: Object.keys(result.rows[0] ?? {}), rows: result.rows };
    }
    const effectiveGroup = groupColumn ?? columnMap.department ?? columnMap.employee_name ?? columnMap.expense_category;
    if (!effectiveGroup) throw new Error("The database has no supported grouping field.");
    const selectedGroup = quoteIdentifier(effectiveGroup);
    const result = await client.query<{ label: string | null; value: string | null }>(`select ${selectedGroup} as label, sum(${amount})::text as value from ${table} ${whereSql} group by ${selectedGroup} order by sum(${amount}) ${order} limit ${query.limit}`, values);
    return { columns: [query.groupBy ?? "group", "amount"], rows: result.rows.map((row) => ({ [query.groupBy ?? "group"]: row.label, amount: Number(row.value ?? 0) })) };
  } finally {
    client.release();
  }
}

export async function answerExpenditureQuestion(question: string): Promise<NlpResponse> {
  if (!question.trim()) throw new Error("Please enter a question about expenditure.");
  const parsedQuery = await parseQuestion(question.trim());
  const result = await executeAnalyticsQuery(parsedQuery);
  const first = result.rows[0];
  let explanation = `${result.rows.length} result${result.rows.length === 1 ? "" : "s"} matched your question.`;
  if (result.columns.length === 1 && first) {
    const amountVal = Number(first.value ?? 0);
    explanation = `${parsedQuery.intent.replaceAll("_", " ")} is ${formatCurrencyINR(amountVal)}.`;
  } else if (parsedQuery.groupBy && first) {
    const groupName = String(first[parsedQuery.groupBy] ?? first.group ?? first.label ?? "Top result");
    const amountVal = Number(first.amount ?? first.value ?? 0);
    if (parsedQuery.limit === 1) {
      explanation = `${groupName} had the ${parsedQuery.sort === "asc" ? "lowest" : "highest"} expenditure (${formatCurrencyINR(amountVal)}).`;
    }
  }
  return { parsedQuery, result, visualization: visualizationFor(parsedQuery), explanation };
}
