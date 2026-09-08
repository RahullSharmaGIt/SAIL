"use client";

import Link from "next/link";
type Props = {
  columns: string[];
  categories: string[];
  statuses: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  tableName: string;
  totalCount: number;
  currentSearch: string;
  currentCategory: string;
  currentStatus: string;
  currentSortBy: string;
  currentSortDirection: string;
};

function readValue(row: Record<string, string | number | boolean | null>, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function DatabaseExplorer({
  columns,
  categories,
  statuses,
  rows,
  tableName,
  totalCount,
  currentSearch,
  currentCategory,
  currentStatus,
  currentSortBy,
  currentSortDirection,
}: Props) {
  return (
    
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Database explorer</p>
            <h1 className="text-3xl font-semibold text-white">Postgres rows from `{tableName}`</h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Filter and sort data from your Docker Postgres database directly from the Next.js home page.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {totalCount} total rows
          </div>
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5" method="get">
          {/* Keep the controls in a GET form so each change becomes a shareable URL state. */}
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Search</span>
            <input
              name="search"
              defaultValue={currentSearch}
              placeholder="Search name, category, status"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Category</span>
            <select
              name="category"
              defaultValue={currentCategory}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Status</span>
            <select
              name="status"
              defaultValue={currentStatus}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Sort by</span>
            <select
              name="sortBy"
              defaultValue={currentSortBy}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="created_at">Created at</option>
              <option value="updated_at">Updated at</option>
              <option value="amount">Amount</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
              <option value="status">Status</option>
              <option value="id">ID</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Direction</span>
            <select
              name="sortDirection"
              defaultValue={currentSortDirection}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <input type="hidden" name="table" value={tableName} />
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-slate-950/20">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-sm text-slate-300">
            Showing {rows.length} row{rows.length === 1 ? "" : "s"} with {columns.length} visible columns
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-slate-950/50">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {column.replaceAll("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/20">
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="transition-colors hover:bg-white/5">
                  {columns.map((column) => (
                    <td key={`${String(row.id ?? index)}-${column}`} className="whitespace-nowrap px-6 py-4 text-sm text-slate-200">
                      {readValue(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-sm text-slate-400" colSpan={columns.length}>
                    No rows matched the current filters. Try clearing the search or switching the sort order.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-slate-200 transition hover:bg-white/5">
          Reset filters
        </Link>
        <span>Data source: Docker Postgres via `DATABASE_URL`.</span>
      </div>
    </div>
  );
}
