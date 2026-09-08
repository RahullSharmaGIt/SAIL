"use client";

import { FormEvent, useState } from "react";

type NlpResult = {
  parsedQuery: { intent: string; filters: Record<string, string | number>; groupBy?: string; sort?: string; limit?: number };
  result: { columns: string[]; rows: Array<Record<string, string | number | null>> };
  visualization: { type: string };
  explanation: string;
};

const examples = [
  "Total travel expenditure in Bokaro during 2025?",
  "What was the total expenditure in 2025?",
  "Which department spent the most?",
  "Show monthly expenditure for 2025.",
  "Show the top 10 employees by expenditure.",
];

function formatAmount(val: number): string {
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(2)} Lakh`;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(val);
}

export function AskYourData() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<NlpResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch("/api/nlp/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = (await response.json()) as NlpResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to answer that question.");
      setAnswer(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to answer that question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-brand-200/60 bg-white p-6 shadow-theme-lg dark:border-white/10 dark:bg-gray-900">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-500">Natural language analytics</p>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Ask Your Data</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions in plain English to automatically generate structured queries and query the PostgreSQL database.</p>
      </div>
      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about expenditure..."
          className="min-h-12 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none ring-brand-500 focus:ring-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <button type="submit" disabled={loading} className="min-h-12 rounded-2xl bg-brand-500 px-6 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">
          {loading ? "Analyzing..." : "Ask"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setQuestion(example)}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-brand-300 hover:text-brand-500 dark:border-gray-700 dark:text-gray-300"
          >
            {example}
          </button>
        ))}
      </div>
      {error ? <p className="mt-5 rounded-2xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</p> : null}
      {answer ? <AnswerCard answer={answer} /> : null}
    </section>
  );
}

function AnswerCard({ answer }: { answer: NlpResult }) {
  const rows = answer.result.rows;
  const amountKey = answer.result.columns.includes("amount") ? "amount" : "value";
  const max = Math.max(...rows.map((row) => Number(row[amountKey] ?? 0)), 1);

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">{answer.explanation}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Interpreted as <span className="font-medium text-gray-700 dark:text-gray-300">{answer.parsedQuery.intent.replaceAll("_", " ")}</span>
            {answer.parsedQuery.groupBy ? ` grouped by ${answer.parsedQuery.groupBy.replaceAll("_", " ")}` : ""}.
          </p>
        </div>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {answer.visualization.type.toUpperCase()}
        </span>
      </div>

      {/* Structured Query Preview */}
      <div className="mt-4 rounded-xl border border-gray-200/80 bg-white p-3.5 dark:border-gray-700/80 dark:bg-gray-900/60">
        <div className="flex items-center justify-between pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span>Structured Query</span>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
            LLM Parsed
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/80">
            <span className="block text-[10px] text-gray-400">Intent</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{answer.parsedQuery.intent}</span>
          </div>
          {Object.entries(answer.parsedQuery.filters).map(([key, val]) => (
            <div key={key} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/80">
              <span className="block text-[10px] capitalize text-gray-400">{key.replaceAll("_", " ")}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{String(val)}</span>
            </div>
          ))}
          {answer.parsedQuery.groupBy && (
            <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/80">
              <span className="block text-[10px] text-gray-400">Group By</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{answer.parsedQuery.groupBy}</span>
            </div>
          )}
        </div>
      </div>

      {/* Visualization */}
      {answer.visualization.type === "kpi" ? (
        <div className="mt-5">
          <p className="text-4xl font-bold tracking-tight text-brand-500">
            {formatAmount(Number(rows[0]?.[amountKey] ?? 0))}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row, index) => {
            const label = String(row[answer.result.columns[0]] ?? "Unknown");
            const amount = Number(row[amountKey] ?? 0);
            return (
              <div key={`${label}-${index}`}>
                <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>{label}</span>
                  <span className="font-semibold">{formatAmount(amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max((amount / max) * 100, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
