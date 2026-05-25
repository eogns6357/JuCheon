import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import { kisDateToISO, formatDate } from "@/lib/stocks";

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Server-side cache ─────────────────────────────────────────────────────────
const _cache = new Map<string, { candles: Candle[]; ts: number }>();

function cacheTtl(period: string): number {
  if (/^\d+$/.test(period)) return 3 * 60 * 1000;      // 3 min  — minute
  if (period === "D")        return 15 * 60 * 1000;     // 15 min — daily
  if (period === "W")        return 60 * 60 * 1000;     // 1 h    — weekly
  return 6 * 60 * 60 * 1000;                             // 6 h    — M / Y
}

// ── KST helpers (minute chart) ────────────────────────────────────────────────
function kstToUnix(date: string, time: string): number {
  const y = +date.slice(0, 4), mo = +date.slice(4, 6) - 1;
  const d = +date.slice(6, 8), h = +time.slice(0, 2);
  const m = +time.slice(2, 4), s = +time.slice(4, 6);
  return Math.floor(Date.UTC(y, mo, d, h - 9, m, s) / 1000);
}

function aggregateMinutes(candles: Candle[], intervalMin: number): Candle[] {
  if (intervalMin <= 1) return candles;
  const step = intervalMin * 60;
  const map = new Map<number, Candle>();
  for (const c of candles) {
    const bucket = Math.floor((c.time as number) / step) * step;
    const b = map.get(bucket);
    if (!b) { map.set(bucket, { ...c, time: bucket }); }
    else { b.high = Math.max(b.high, c.high); b.low = Math.min(b.low, c.low); b.close = c.close; b.volume += c.volume; }
  }
  return [...map.values()].sort((a, b) => (a.time as number) - (b.time as number));
}

// ── KIS pagination ────────────────────────────────────────────────────────────
async function fetchPaged(ticker: string, periodCode: string): Promise<Candle[]> {
  const maxPages = 20;
  const farStart = new Date();
  farStart.setFullYear(farStart.getFullYear() - 30);
  let endDate = new Date();

  const seen = new Set<string>();
  const allRows: Record<string, string>[] = [];

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, 200));

    let data: Record<string, unknown>;
    try {
      data = await kisGet(
        "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
        {
          FID_COND_MRKT_DIV_CODE: "J",
          FID_INPUT_ISCD: ticker,
          FID_INPUT_DATE_1: formatDate(farStart),
          FID_INPUT_DATE_2: formatDate(endDate),
          FID_PERIOD_DIV_CODE: periodCode,
          FID_ORG_ADJ_PRC: "0",
        },
        "FHKST03010100"
      );
    } catch { break; }

    const rows = ((data.output2 ?? []) as Record<string, string>[]).filter(
      (r) => r.stck_bsop_date && parseInt(r.stck_clpr, 10) > 0
    );
    if (!rows.length) break;

    let added = 0;
    for (const r of rows) {
      if (!seen.has(r.stck_bsop_date)) { seen.add(r.stck_bsop_date); allRows.push(r); added++; }
    }
    if (added === 0 || rows.length < 100) break;

    const oldest = rows[rows.length - 1].stck_bsop_date;
    const d = new Date(kisDateToISO(oldest));
    d.setDate(d.getDate() - 1);
    endDate = d;
  }

  return allRows
    .sort((a, b) => a.stck_bsop_date.localeCompare(b.stck_bsop_date))
    .map((r) => ({
      time: kisDateToISO(r.stck_bsop_date),
      open: parseInt(r.stck_oprc, 10),
      high: parseInt(r.stck_hgpr, 10),
      low: parseInt(r.stck_lwpr, 10),
      close: parseInt(r.stck_clpr, 10),
      volume: parseInt(r.acml_vol, 10),
    }));
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const period = req.nextUrl.searchParams.get("period") ?? "D";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const minuteInterval = /^\d+$/.test(period) ? parseInt(period) : 0;

    if (minuteInterval > 0) {
      // ── Minute chart (분봉) ───────────────────────────────────────
      const key = `${ticker}_${period}`;
      const hit = _cache.get(key);
      if (hit && Date.now() - hit.ts < cacheTtl(period)) {
        return NextResponse.json({ ticker, candles: hit.candles, period });
      }

      const collected: Candle[] = [];
      const seen = new Set<number>();
      let fetchHour = "160000";

      for (let pass = 0; pass < 5; pass++) {
        const data = await kisGet(
          "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice",
          {
            FID_ETC_CLS_CODE: "",
            FID_COND_MRKT_DIV_CODE: "J",
            FID_INPUT_ISCD: ticker,
            FID_INPUT_HOUR_1: fetchHour,
            FID_PW_DATA_INCU_YN: "Y",
          },
          "FHKST03010200"
        );
        const rows: Record<string, string>[] = data.output2 ?? [];
        if (!rows.length) break;

        let newCount = 0;
        let earliestHour = fetchHour;
        for (const r of rows) {
          if (!r.stck_bsop_date || !r.stck_cntg_hour) continue;
          const t = kstToUnix(r.stck_bsop_date, r.stck_cntg_hour);
          if (seen.has(t)) continue;
          seen.add(t); newCount++;
          earliestHour = r.stck_cntg_hour;
          const close = parseInt(r.stck_prpr || r.stck_clpr, 10) || 0;
          if (close <= 0) continue;
          collected.push({ time: t, open: parseInt(r.stck_oprc, 10) || close, high: parseInt(r.stck_hgpr, 10) || close, low: parseInt(r.stck_lwpr, 10) || close, close, volume: parseInt(r.cntg_vol || "0", 10) });
        }
        if (newCount === 0) break;
        const h = +earliestHour.slice(0, 2), m = +earliestHour.slice(2, 4);
        const prev = h * 60 + m - 1;
        if (prev < 9 * 60) break;
        fetchHour = `${String(Math.floor(prev / 60)).padStart(2, "0")}${String(prev % 60).padStart(2, "0")}00`;
        if (pass < 4) await new Promise((r) => setTimeout(r, 100));
      }

      const sorted = collected.sort((a, b) => (a.time as number) - (b.time as number));
      const candles = aggregateMinutes(sorted, minuteInterval);
      _cache.set(key, { candles, ts: Date.now() });
      return NextResponse.json({ ticker, candles, period });

    } else {
      // ── D / W / M / Y: try FDR first, fall back to KIS pagination ─
      const periodCode = ["D", "W", "M", "Y"].includes(period) ? period : "D";
      const key = `${ticker}_${periodCode}`;

      const hit = _cache.get(key);
      if (hit && Date.now() - hit.ts < cacheTtl(periodCode)) {
        return NextResponse.json({ ticker, candles: hit.candles, period });
      }

      const candles = await fetchPaged(ticker, periodCode);

      _cache.set(key, { candles, ts: Date.now() });
      return NextResponse.json({ ticker, candles, period });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
