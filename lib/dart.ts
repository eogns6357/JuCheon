import { resolveDartCorpCode } from "@/lib/dart-corp-index";

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

async function dartList(
  params: Record<string, string>
): Promise<Record<string, string>[]> {
  const key = dartApiKey();
  if (!key) return [];

  const qs = new URLSearchParams({ crtfc_key: key, page_count: "30", ...params });
  const res = await fetch(`https://opendart.fss.or.kr/api/list.json?${qs}`, {
    next: { revalidate: 300 },
  });
  const data = await res.json();

  if (data.status !== "000") {
    const msg = data.message ?? `status ${data.status}`;
    throw new Error(`DART: ${msg}`);
  }
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

/** 종목코드(우선) 또는 회사명으로 최근 공시 조회 */
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

  try {
    const corpCode = await resolveDartCorpCode(stock);
    if (corpCode) {
      const rows = await dartList({ corp_code: corpCode, ...range });
      if (rows.length > 0) return mapRows(rows);
    }
  } catch {
    /* corp_code 조회 실패 시 회사명으로 폴백 */
  }

  const name = opts.corpName?.trim();
  if (!name) return [];

  try {
    const rows = await dartList({ corp_name: name, ...range });
    return mapRows(rows);
  } catch {
    return [];
  }
}
