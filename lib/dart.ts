export interface DartDisclosure {
  corpName: string;
  title: string;
  date: string;
  submitter: string;
  rceptNo: string;
  url: string;
}

function formatDartDate(yyyymmdd: string) {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
}

function dartApiKey() {
  return process.env.DART_API_KEY?.trim() ?? "";
}

export function isDartConfigured() {
  return Boolean(dartApiKey());
}

// Memory cache: stock code → DART corp_code
const _corpCodeCache = new Map<string, string>();

async function resolveCorpCode(stockCode: string): Promise<string | null> {
  const key = dartApiKey();
  if (!key) return null;

  if (_corpCodeCache.has(stockCode)) return _corpCodeCache.get(stockCode)!;

  try {
    const res = await fetch(
      `https://opendart.fss.or.kr/api/company.json?crtfc_key=${key}&stock_code=${stockCode}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { status?: string; corp_code?: string };
    if (data.status !== "000" || !data.corp_code) return null;
    _corpCodeCache.set(stockCode, data.corp_code);
    return data.corp_code;
  } catch {
    return null;
  }
}

async function dartList(params: Record<string, string>): Promise<Record<string, string>[]> {
  const key = dartApiKey();
  if (!key) return [];

  const qs = new URLSearchParams({ crtfc_key: key, page_count: "20", ...params });
  const res = await fetch(`https://opendart.fss.or.kr/api/list.json?${qs}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json() as { status?: string; list?: Record<string, string>[] };
  if (data.status !== "000") return [];
  return Array.isArray(data.list) ? data.list : [];
}

function mapRows(rows: Record<string, string>[]): DartDisclosure[] {
  return rows.map((row) => ({
    corpName: row.corp_name ?? "",
    title: row.report_nm ?? "",
    date: formatDartDate(row.rcept_dt ?? ""),
    submitter: row.flr_nm ?? "",
    rceptNo: row.rcept_no ?? "",
    url: row.rcept_no
      ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.rcept_no}`
      : "https://dart.fss.or.kr",
  }));
}

function dateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return { bgn_de: fmt(start), end_de: fmt(end) };
}

export async function fetchDartDisclosures(opts: {
  ticker: string;
  corpName?: string;
  days?: number;
}): Promise<DartDisclosure[]> {
  const key = dartApiKey();
  if (!key) return [];

  const days = opts.days ?? 30;
  const range = dateRange(days);
  const stock = opts.ticker.replace(/\D/g, "").padStart(6, "0").slice(-6);

  // Try corp_code lookup via /api/company.json (fast single call, no ZIP download)
  const corpCode = await resolveCorpCode(stock);
  if (corpCode) {
    const rows = await dartList({ corp_code: corpCode, ...range });
    if (rows.length > 0) return mapRows(rows);
  }

  // Fallback: search by company name
  const name = opts.corpName?.trim();
  if (!name) return [];
  const rows = await dartList({ corp_name: name, ...range });
  return mapRows(rows);
}
