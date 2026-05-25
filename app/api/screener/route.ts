import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import { calcIndicators, signalScore, calcInvestorBonus, type OHLCV } from "@/lib/indicators";
import { formatDate, kisDateToISO } from "@/lib/stocks";

// 거래대금 최소 기준: 10억 원/일 (유동성 미달 종목 제외)
const MIN_TRADE_VALUE = 1_000_000_000;

interface StockResult {
  ticker: string; name: string;
  open: number; high: number; low: number; close: number;
  changeRate: number; ret5d: number;
  volume: number; volRatio: number;
  rsi: number | null;
  macd: number | null; macdSignal: number | null; macdHist: number | null;
  ma5: number | null; ma20: number | null; ma60: number | null;
  bbUpper: number | null; bbMiddle: number | null; bbLower: number | null;
  atr: number | null;
  high20: number; pullbackPct: number;
  strategies: string[];
  score: number;
  foreignNet5d: number;
  instNet5d: number;
}

async function fetchOHLCV(ticker: string): Promise<OHLCV[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 120);

  const data = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: ticker,
      FID_INPUT_DATE_1: formatDate(start),
      FID_INPUT_DATE_2: formatDate(end),
      FID_PERIOD_DIV_CODE: "D",
      FID_ORG_ADJ_PRC: "0",
    },
    "FHKST03010100"
  );

  return (data.output2 ?? [])
    .filter((r: Record<string, string>) => r.stck_bsop_date && parseInt(r.acml_vol) > 0)
    .reverse()
    .map((r: Record<string, string>) => ({
      date: kisDateToISO(r.stck_bsop_date),
      open:   parseInt(r.stck_oprc, 10),
      high:   parseInt(r.stck_hgpr, 10),
      low:    parseInt(r.stck_lwpr, 10),
      close:  parseInt(r.stck_clpr, 10),
      volume: parseInt(r.acml_vol, 10),
    }));
}

function applyStrategies(ohlcv: OHLCV[], name: string): StockResult | null {
  if (ohlcv.length < 40) return null;

  const withInd = calcIndicators(ohlcv);
  const last = withInd[withInd.length - 1];
  const prev = withInd[withInd.length - 2];
  if (!prev) return null;

  const c = last.close;

  // ── 거래대금 필터 ─────────────────────────────────────────────────
  if (c * last.volume < MIN_TRADE_VALUE) return null;

  const rsi      = last.rsi ?? 50;
  const prevRsi  = prev.rsi ?? rsi;
  const macdVal  = last.macd?.MACD ?? 0;
  const macdSig  = last.macd?.signal ?? 0;
  const prevMacd = prev.macd?.MACD ?? 0;
  const prevSig  = prev.macd?.signal ?? 0;
  const ma5      = last.ma5  ?? c;
  const ma20     = last.ma20 ?? c;
  const ma60     = last.ma60 ?? c;
  const prevMa5  = prev.ma5  ?? ma5;
  const prevMa20 = prev.ma20 ?? ma20;

  // 거래량 비율 (20일 평균 대비)
  const avgVol20 = ohlcv.slice(-21, -1).reduce((s, r) => s + r.volume, 0) / 20;
  const volRatio = avgVol20 > 0 ? last.volume / avgVol20 : 1;

  // 수익률
  const ret1d = ((c - prev.close) / prev.close) * 100;
  const close5ago = ohlcv[ohlcv.length - 6]?.close ?? c;
  const ret5d = ((c - close5ago) / close5ago) * 100;

  // 20일 최고가 대비 눌림폭
  const high20 = Math.max(...ohlcv.slice(-20).map((r) => r.close));
  const pullbackPct = ((c - high20) / high20) * 100;

  // ── 전략 1: 거래량 돌파 ──────────────────────────────────────────
  // 조건: 거래량 2배↑ + MA20 위 + RSI 40~70 + 당일 양봉
  const s1 =
    volRatio >= 2.0 &&
    c > ma20 &&
    rsi >= 40 && rsi <= 70 &&
    ret1d > 0;

  // ── 전략 2: 골든크로스 ──────────────────────────────────────────
  // 조건: MA5가 MA20 상향 돌파 + 가격도 MA20 위 (가짜 크로스 제외)
  const s2 =
    ma5 > ma20 &&
    prevMa5 <= prevMa20 &&
    c > ma20;

  // ── 전략 3: MACD 전환 ────────────────────────────────────────────
  // 조건: MACD가 시그널선 상향 돌파 + MA20 위 + RSI < 70 (과매수 크로스 제외)
  const s3 =
    macdVal > macdSig &&
    prevMacd <= prevSig &&
    c > ma20 &&
    rsi < 70;

  // ── 전략 4: 눌림목 반등 ─────────────────────────────────────────
  // 조건: 20일 고점 대비 -3~-15% 조정 + MA60 위 + RSI 35~60 + RSI 반등 시작
  //       + MACD 양전환 + 거래량 회복
  const s4 =
    pullbackPct > -15 && pullbackPct < -3 &&
    c > ma60 &&
    rsi >= 35 && rsi <= 60 &&
    rsi > prevRsi &&          // RSI가 바닥 찍고 상승 반전
    macdVal > macdSig &&
    volRatio > 1.2;

  const strategies: string[] = [];
  if (s1) strategies.push("거래량돌파");
  if (s2) strategies.push("골든크로스");
  if (s3) strategies.push("MACD전환");
  if (s4) strategies.push("눌림목반등");

  if (strategies.length === 0) return null;

  const score = signalScore(withInd, volRatio);

  return {
    ticker: last.date, // placeholder, overwritten in GET
    name,
    open:       last.open,
    high:       last.high,
    low:        last.low,
    close:      c,
    changeRate: ret1d,
    ret5d,
    volume:     last.volume,
    volRatio,
    rsi:        last.rsi,
    macd:       last.macd?.MACD ?? null,
    macdSignal: last.macd?.signal ?? null,
    macdHist:   last.macd?.histogram ?? null,
    ma5:        last.ma5 ?? null,
    ma20:       last.ma20 ?? null,
    ma60:       last.ma60 ?? null,
    bbUpper:    last.bb?.upper ?? null,
    bbMiddle:   last.bb?.middle ?? null,
    bbLower:    last.bb?.lower ?? null,
    atr:        last.atr ?? null,
    high20,
    pullbackPct,
    strategies,
    score,
    foreignNet5d: 0,
    instNet5d: 0,
  };
}

/** 최대 20개씩 병렬 처리 (KIS rate limit 대응) */
async function batchFetch<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  batchSize = 20
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return results;
}

export async function GET(req: NextRequest) {
  const count = parseInt(req.nextUrl.searchParams.get("count") ?? "100");

  try {
    const base = req.nextUrl.origin;
    const tickerRes = await fetch(`${base}/api/tickers?count=${count}`);
    const tickerData = await tickerRes.json();

    if (tickerData.error) {
      return NextResponse.json({ error: `종목 목록 오류: ${tickerData.error}` }, { status: 500 });
    }

    const pool: { ticker: string; name: string }[] = tickerData.tickers ?? [];

    const raw = await batchFetch(pool, async ({ ticker, name }) => {
      const ohlcv = await fetchOHLCV(ticker);
      const result = applyStrategies(ohlcv, name);
      if (!result) return null;
      return { ...result, ticker };
    });

    const passing = raw
      .filter(
        (r): r is PromiseFulfilledResult<StockResult> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    // Fetch investor data only for stocks that passed the filter
    const investorResults = await batchFetch(
      passing.map((s) => s.ticker),
      async (ticker: string) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 15);
        const data = await kisGet(
          "/uapi/domestic-stock/v1/quotations/inquire-investor",
          {
            FID_COND_MRKT_DIV_CODE: "J",
            FID_INPUT_ISCD: ticker,
            FID_INPUT_DATE_1: formatDate(start),
            FID_INPUT_DATE_2: formatDate(end),
          },
          "FHKST01010900"
        );
        // output2 newest-first → slice(0,5) = last 5 trading days
        const rows = ((data.output2 ?? []) as Record<string, string>[]).slice(0, 5);
        const foreign5d = rows.reduce((s, r) => s + parseInt(r.frgn_ntby_qty ?? "0", 10), 0);
        const inst5d = rows.reduce((s, r) => s + parseInt(r.orgn_ntby_qty ?? "0", 10), 0);
        return { ticker, foreign5d, inst5d };
      },
      5
    );

    const invMap = new Map<string, { foreign5d: number; inst5d: number }>();
    investorResults.forEach((r) => {
      if (r.status === "fulfilled" && r.value) {
        const v = r.value as { ticker: string; foreign5d: number; inst5d: number };
        invMap.set(v.ticker, { foreign5d: v.foreign5d, inst5d: v.inst5d });
      }
    });

    const stocks = passing
      .map((s) => {
        const inv = invMap.get(s.ticker) ?? { foreign5d: 0, inst5d: 0 };
        const bonus = calcInvestorBonus(inv.foreign5d, inv.inst5d);
        return {
          ...s,
          foreignNet5d: inv.foreign5d,
          instNet5d: inv.inst5d,
          score: Math.min(100, Math.max(0, s.score + bonus)),
        };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ stocks, scanned: pool.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
