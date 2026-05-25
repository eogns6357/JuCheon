import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";

export const maxDuration = 60;
import { calcIndicators, signalScore, type OHLCV } from "@/lib/indicators";
import { formatDate, kisDateToISO } from "@/lib/stocks";

// ── Server-side cache (15 min TTL for daily data) ─────────────────────────────
const _cache = new Map<string, { ohlcv: OHLCV[]; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000;

// ── KIS pagination ────────────────────────────────────────────────────────────
async function fetchPaged(ticker: string): Promise<OHLCV[]> {
  const maxPages = 20;
  const farStart = new Date();
  farStart.setFullYear(farStart.getFullYear() - 10);
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
          FID_PERIOD_DIV_CODE: "D",
          FID_ORG_ADJ_PRC: "0",
        },
        "FHKST03010100"
      );
    } catch { break; }

    const rows = ((data.output2 ?? []) as Record<string, string>[]).filter(
      (r) => r.stck_bsop_date && parseInt(r.acml_vol, 10) > 0
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
      date: kisDateToISO(r.stck_bsop_date),
      open: parseInt(r.stck_oprc, 10),
      high: parseInt(r.stck_hgpr, 10),
      low: parseInt(r.stck_lwpr, 10),
      close: parseInt(r.stck_clpr, 10),
      volume: parseInt(r.acml_vol, 10),
    }));
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "250");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    // ── Cache check ─────────────────────────────────────────────────
    const hit = _cache.get(ticker);
    let ohlcv: OHLCV[];

    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      ohlcv = hit.ohlcv;
    } else {
      ohlcv = await fetchPaged(ticker);
      if (ohlcv.length < 30) {
        return NextResponse.json({ error: "데이터 부족" }, { status: 400 });
      }
      _cache.set(ticker, { ohlcv, ts: Date.now() });
    }

    const withInd = calcIndicators(ohlcv);
    const last = withInd[withInd.length - 1];
    const prev = withInd[withInd.length - 2];

    const avgVol20 = ohlcv.slice(-21, -1).reduce((s, r) => s + r.volume, 0) / 20;
    const volRatio = avgVol20 > 0 ? last.volume / avgVol20 : 1;
    const score = signalScore(withInd, volRatio);

    const sliced = withInd.slice(-days);

    const vma20: (number | null)[] = sliced.map((_, i) => {
      const full_i = withInd.length - days + i;
      if (full_i < 20) return null;
      const sum = withInd.slice(full_i - 20, full_i).reduce((s, r) => s + r.volume, 0);
      return sum / 20;
    });

    const series = sliced.map((d, i) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      vma20: vma20[i],
      rsi: d.rsi,
      macd: d.macd?.MACD ?? null,
      macdSignal: d.macd?.signal ?? null,
      macdHist: d.macd?.histogram ?? null,
      bbUpper: d.bb?.upper ?? null,
      bbMiddle: d.bb?.middle ?? null,
      bbLower: d.bb?.lower ?? null,
      ma5: d.ma5,
      ma20: d.ma20,
      ma60: d.ma60,
      ma120: d.ma120,
    }));

    const rsi = last.rsi ?? 50;
    const macdHist = last.macd?.histogram ?? 0;
    const macdVal = last.macd?.MACD ?? 0;
    const macdSig = last.macd?.signal ?? 0;
    const close5ago = ohlcv[ohlcv.length - 6]?.close ?? last.close;
    const ret5d = ((last.close - close5ago) / close5ago) * 100;
    const prevClose = prev?.close ?? last.close;
    const ret1d = ((last.close - prevClose) / prevClose) * 100;

    const bbPos = last.bb
      ? ((last.close - last.bb.lower) / (last.bb.upper - last.bb.lower)) * 100
      : 50;

    const trend =
      last.ma5 && last.ma20 && last.ma60
        ? last.close > last.ma20 && last.ma20 > last.ma60
          ? "상승"
          : last.close < last.ma20 && last.ma20 < last.ma60
          ? "하락"
          : "횡보"
        : "알 수 없음";

    const summary = {
      date: last.date,
      close: last.close,
      ret1d,
      ret5d,
      rsi,
      macd: macdVal,
      macdSignal: macdSig,
      macdHist,
      bbPos,
      ma5: last.ma5,
      ma20: last.ma20,
      ma60: last.ma60,
      ma120: last.ma120,
      atr: last.atr,
      volRatio,
      score,
      trend,
    };

    return NextResponse.json({ series, summary });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
