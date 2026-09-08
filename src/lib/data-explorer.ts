import { getPool, isSafeIdentifier } from "@/lib/postgres";

export type SortDirection = "asc" | "desc";
export type SortField = "id" | "name" | "category" | "status" | "amount" | "created_at" | "updated_at";

export type ExplorerRow = Record<string, string | number | boolean | null>;

export type ExplorerState = {
  rows: ExplorerRow[];
  columns: string[];
  tableName: string;
  categories: string[];
  statuses: string[];
  totalCount: number;
  currentSearch: string;
  currentCategory: string;
  currentStatus: string;
  currentSortBy: string;
  currentSortDirection: SortDirection;
};

const FALLBACK_TABLE = process.env.DATABASE_TABLE ?? "records";

function clampPageSize(value: string | null | undefined) {
  const parsed = Number(value ?? "10");
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(50, Math.max(5, Math.trunc(parsed)));
}

function parseSortField(value: string | null | undefined): SortField | null {
  const allowed: SortField[] = ["created_at", "updated_at", "amount", "name", "category", "status", "id"];
  if (value && allowed.includes(value as SortField)) return value as SortField;
  return null;
}

function parseSortDirection(value: string | null | undefined): SortDirection {
  return value?.toLowerCase() === "asc" ? "asc" : "desc";
}

export async function loadExplorerState(searchParams: Record<string, string | string[] | undefined>): Promise<ExplorerState> {
  const requestedTable = typeof searchParams.table === "string" && isSafeIdentifier(searchParams.table) ? searchParams.table : FALLBACK_TABLE;
  const pageSize = clampPageSize(typeof searchParams.pageSize === "string" ? searchParams.pageSize : undefined);
  const sortByFromQuery = parseSortField(typeof searchParams.sortBy === "string" ? searchParams.sortBy : undefined);
  const sortDirection = parseSortDirection(typeof searchParams.sortDirection === "string" ? searchParams.sortDirection : undefined);
  const category = typeof searchParams.category === "string" && searchParams.category !== "all" ? searchParams.category : undefined;
  const status = typeof searchParams.status === "string" && searchParams.status !== "all" ? searchParams.status : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";

  const pool = getPool();
  const client = await pool.connect();

  try {
    const tableCandidates = await client.query<{ table_name: string }>(
      `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name asc
      `,
    );

    const tableName =
      tableCandidates.rows.some((row) => row.table_name === requestedTable)
        ? requestedTable
        : tableCandidates.rows[0]?.table_name ?? requestedTable;

    if (!isSafeIdentifier(tableName)) {
      throw new Error(`Unsafe table name "${tableName}". Use a table made of letters, numbers, and underscores.`);
    }

    const columnResult = await client.query<{ column_name: string }>(
      //PostgreSQL-provided set of metadata tables.
      `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
      order by ordinal_position
      `,
      [tableName],
    );

    const columns = columnResult.rows.map((row) => row.column_name);
    const defaultColumns = columns.length > 0 ? columns : ["id", "name", "category", "status", "amount", "created_at"];
    const columnSet = new Set(defaultColumns);
    const selectColumns = defaultColumns.map((column) => `"${column}"`).join(", ");
    const sortBy =
      sortByFromQuery && columnSet.has(sortByFromQuery)
        ? sortByFromQuery
        : ["created_at", "updated_at", "amount", "name", "category", "status", "id"].find((candidate) => columnSet.has(candidate)) ?? defaultColumns[0];

    const whereParts: string[] = [];
    const values: Array<string | number> = [];

    if (category) {
      values.push(category);
      whereParts.push(`category = $${values.length}`);
    }

    if (status) {
      values.push(status);
      whereParts.push(`status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      const placeholder = `$${values.length}`;
      const searchable = ["name", "category", "status"]
        .filter((field) => columnSet.has(field))
        .map((field) => `${field} ILIKE ${placeholder}`);
      if (searchable.length > 0) whereParts.push(`(${searchable.join(" OR ")})`);
    }

    const whereSql = whereParts.length > 0 ? `where ${whereParts.join(" and ")}` : "";
    const orderBySql = `order by "${sortBy}" ${sortDirection.toUpperCase()}`;

    const countResult = await client.query<{ count: string }>(`select count(*)::text as count from "${tableName}" ${whereSql}`, values);
    const dataResult = await client.query<ExplorerRow>(
      `
      select ${selectColumns}
      from "${tableName}"
      ${whereSql}
      ${orderBySql}
      limit ${pageSize}
      `,
      values,
    );

    const distinctCategoryResult = columnSet.has("category")
      ? await client.query<{ category: string | null }>(`select distinct category from "${tableName}" where category is not null order by category asc`)
      : { rows: [] as Array<{ category: string | null }> };
    const distinctStatusResult = columnSet.has("status")
      ? await client.query<{ status: string | null }>(`select distinct status from "${tableName}" where status is not null order by status asc`)
      : { rows: [] as Array<{ status: string | null }> };

    return {
      rows: dataResult.rows,
      columns: defaultColumns,
      tableName,
      categories: distinctCategoryResult.rows.map((row) => row.category).filter((value): value is string => Boolean(value)),
      statuses: distinctStatusResult.rows.map((row) => row.status).filter((value): value is string => Boolean(value)),
      totalCount: Number(countResult.rows[0]?.count ?? 0),
      currentSearch: search,
      currentCategory: category ?? "all",
      currentStatus: status ?? "all",
      currentSortBy: sortBy,
      currentSortDirection: sortDirection,
    };
  } finally {
    client.release();
  }
}
