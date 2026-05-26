import { NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import { formatDate, kisDateToISO } from "@/lib/stocks";
import { calcIndicators, type OHLCV } from "@/lib/indicators";
import { resolveGeminiModels, isRetryableGeminiError } from "@/lib/gemini-models";

export const maxDuration = 60;

// ── 캐시 (30분) ──────────────────────────────────────────────────────────────
const _cache = new Map<string, { data: PicksResponse; ts: number }>();
const TTL = 30 * 60 * 1000;

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface StockPick {
  ticker: string;
  name: string;
  reason: string;
  signals: string;
  entry: string;
  target: string;
  stop: string;
}

export interface PickCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  stocks: StockPick[];
}

export interface PicksResponse {
  categories: PickCategory[];
  generatedAt: string;
  stale?: boolean;
}

// ── OHLCV 조회 ────────────────────────────────────────────────────────────────
async function fetchOHLCV(ticker: string): Promise<OHLCV[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 80);
  try {
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
    return ((data.output2 ?? []) as Record<string, string>[])
      .filter((r) => r.stck_bsop_date && parseInt(r.acml_vol) > 0)
      .reverse()
      .map((r) => ({
        date: kisDateToISO(r.stck_bsop_date),
        open:   parseInt(r.stck_oprc, 10),
        high:   parseInt(r.stck_hgpr, 10),
        low:    parseInt(r.stck_lwpr, 10),
        close:  parseInt(r.stck_clpr, 10),
        volume: parseInt(r.acml_vol,  10),
      }));
  } catch { return []; }
}

// ── 외국인·기관 수급 ──────────────────────────────────────────────────────────
async function fetchInvestor(ticker: string): Promise<{ foreign5d: number; inst5d: number }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 10);
  try {
    const data = await kisGet(
      "/uapi/domestic-stock/v1/quotations/inquire-investor",
      { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: ticker, FID_INPUT_DATE_1: formatDate(start), FID_INPUT_DATE_2: formatDate(end) },
      "FHKST01010900"
    );
    const rows = ((data.output2 ?? []) as Record<string, string>[]).slice(0, 5);
    return {
      foreign5d: rows.reduce((s, r) => s + parseInt(r.frgn_ntby_qty ?? "0", 10), 0),
      inst5d:    rows.reduce((s, r) => s + parseInt(r.orgn_ntby_qty ?? "0", 10), 0),
    };
  } catch { return { foreign5d: 0, inst5d: 0 }; }
}

// ── 종목 분석 데이터 수집 ─────────────────────────────────────────────────────
interface StockData {
  ticker: string;
  name: string;
  close: number;
  ret1d: number;
  ret5d: number;
  rsi: number;
  macdHist: number;
  aboveMa20: boolean;
  aboveMa60: boolean;
  ma5AboveMa20: boolean;
  volRatio: number;
  pullbackPct: number;
  foreign5d: number;
  inst5d: number;
  tradeValue: number;
}

async function analyzeStock(ticker: string, name: string): Promise<StockData | null> {
  const ohlcv = await fetchOHLCV(ticker);
  if (ohlcv.length < 30) return null;

  const withInd = calcIndicators(ohlcv);
  const last = withInd[withInd.length - 1];
  const prev = withInd[withInd.length - 2];
  if (!last || !prev) return null;

  const avgVol = ohlcv.slice(-21, -1).reduce((s, r) => s + r.volume, 0) / 20;
  const high20 = Math.max(...ohlcv.slice(-20).map((r) => r.close));

  return {
    ticker,
    name,
    close: last.close,
    ret1d: prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0,
    ret5d: ohlcv[ohlcv.length - 6]
      ? ((last.close - ohlcv[ohlcv.length - 6].close) / ohlcv[ohlcv.length - 6].close) * 100 : 0,
    rsi: last.rsi ?? 50,
    macdHist: last.macd?.histogram ?? 0,
    aboveMa20: last.ma20 != null && last.close > last.ma20,
    aboveMa60: last.ma60 != null && last.close > last.ma60,
    ma5AboveMa20: (last.ma5 ?? 0) > (last.ma20 ?? Infinity),
    volRatio: avgVol > 0 ? last.volume / avgVol : 1,
    pullbackPct: ((last.close - high20) / high20) * 100,
    foreign5d: 0,
    inst5d: 0,
    tradeValue: last.close * last.volume,
  };
}

// ── Gemini 추천 생성 ──────────────────────────────────────────────────────────
async function generatePicks(stocks: StockData[]): Promise<PickCategory[]> {
  const lines = stocks.map((s) => {
    const sup = s.foreign5d > 0 && s.inst5d > 0 ? "외국인+기관 쌍끌이" :
                s.foreign5d > 0 ? "외국인 순매수" :
                s.inst5d > 0 ? "기관 순매수" : "수급 중립";
    return `${s.name}(${s.ticker}) | 종가 ${s.close.toLocaleString()}원 | 전일 ${s.ret1d >= 0 ? "+" : ""}${s.ret1d.toFixed(1)}% | 5일 ${s.ret5d >= 0 ? "+" : ""}${s.ret5d.toFixed(1)}% | RSI ${s.rsi.toFixed(0)} | MACD히스트 ${s.macdHist > 0 ? "양" : "음"} | MA20 ${s.aboveMa20 ? "위" : "아래"} | MA60 ${s.aboveMa60 ? "위" : "아래"} | 거래량 ${s.volRatio.toFixed(1)}배 | 눌림 ${s.pullbackPct.toFixed(1)}% | ${sup}`;
  }).join("\n");

  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

  const prompt = `당신은 한국 주식 단기 매매 전문 트레이더입니다.
아래 종목 데이터(${today} 기준)를 분석해서, 4개 투자 영역으로 나눠 각 3종목씩 추천하세요.

[종목 데이터]
${lines}

[4개 영역 정의]
1. momentum — 단기 모멘텀: 거래량 폭발 + MA 돌파 + RSI 상승 중인 종목
2. supply — 수급 집중: 외국인·기관 순매수가 뚜렷하게 집중되는 종목
3. bounce — 기술적 반등: 단기 과매도 후 반등 셋업 완성 (눌림목 + RSI 반등)
4. theme — 테마 주도: 최근 5일 강한 상승 모멘텀 + 섹터/뉴스 수혜 포지션

[출력 규칙]
- 반드시 JSON만 출력. 마크다운 코드블록 없이 순수 JSON.
- 각 영역에서 데이터에 있는 종목 중 가장 적합한 3개 선정 (없으면 가장 근접한 종목)
- reason: 이 종목을 지금 매수해야 하는 이유 2문장 (구체적 수치 포함)
- signals: 핵심 지표 3개 요약 (예: "RSI 58 · MA20 위 · 거래량 2.3배")
- entry: 진입 방법 (예: "시초가 +1% 이내 매수" 또는 "눌림 확인 후 진입")
- target: 목표 수익률 (예: "+4~6%")
- stop: 손절 기준 (예: "-2% 또는 MA20 이탈")

{
  "categories": [
    {
      "id": "momentum",
      "title": "단기 모멘텀",
      "emoji": "🚀",
      "description": "거래량 폭발과 MA 돌파가 동시에 나타나는 강세 종목",
      "stocks": [
        { "ticker": "...", "name": "...", "reason": "...", "signals": "...", "entry": "...", "target": "...", "stop": "..." },
        { "ticker": "...", "name": "...", "reason": "...", "signals": "...", "entry": "...", "target": "...", "stop": "..." },
        { "ticker": "...", "name": "...", "reason": "...", "signals": "...", "entry": "...", "target": "...", "stop": "..." }
      ]
    },
    {
      "id": "supply",
      "title": "수급 집중",
      "emoji": "💰",
      "description": "외국인·기관 스마트머니가 집중 매수하는 종목",
      "stocks": [...]
    },
    {
      "id": "bounce",
      "title": "기술적 반등",
      "emoji": "📈",
      "description": "단기 조정 후 반등 셋업이 완성된 눌림목 종목",
      "stocks": [...]
    },
    {
      "id": "theme",
      "title": "테마 주도",
      "emoji": "⚡",
      "description": "강한 상승 모멘텀으로 섹터를 이끄는 주도 종목",
      "stocks": [...]
    }
  ]
}`;

  const models = resolveGeminiModels();
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    if (data.error) {
      if (isRetryableGeminiError(data.error)) continue;
      throw new Error(data.error.message);
    }
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) continue;

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;
    const parsed = JSON.parse(jsonMatch[0]) as { categories: PickCategory[] };
    return parsed.categories ?? [];
  }
  throw new Error("AI 추천 생성 실패");
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const hit = _cache.get("picks");
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data);
  }

  try {
    // 거래량·거래대금 상위 종목 조회
    const moodRes = await kisGet(
      "/uapi/domestic-stock/v1/quotations/volume-rank",
      {
        FID_COND_MRKT_DIV_CODE: "J",
        FID_COND_SCR_DIV_CODE: "20171",
        FID_INPUT_ISCD: "0000",
        FID_DIV_CLS_CODE: "0",
        FID_BLNG_CLS_CODE: "0",
        FID_TRGT_CLS_CODE: "111111111",
        FID_TRGT_EXLS_CLS_CODE: "0000000000",
        FID_INPUT_PRICE_1: "",
        FID_INPUT_PRICE_2: "",
        FID_VOL_CNT: "100000",
        FID_INPUT_DATE_1: "",
      },
      "FHPST01710000"
    );
    const topRows = ((moodRes.output ?? moodRes.output1 ?? []) as Record<string, string>[]).slice(0, 20);
    const topStocks = topRows.map((r) => ({
      ticker: (r.stck_shrn_iscd ?? r.mksc_shrn_iscd ?? "").trim(),
      name:   (r.hts_kor_isnm ?? r.prdt_name ?? "").trim(),
    })).filter((s) => s.ticker && s.name);

    // 병렬로 지표 계산
    const results = await Promise.allSettled(
      topStocks.map((s) => analyzeStock(s.ticker, s.name))
    );
    const analyzed = results
      .filter((r): r is PromiseFulfilledResult<StockData> => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value);

    // 수급 데이터 보강 (상위 10개만)
    const invResults = await Promise.allSettled(
      analyzed.slice(0, 10).map((s) => fetchInvestor(s.ticker).then((inv) => ({ ticker: s.ticker, ...inv })))
    );
    const invMap = new Map<string, { foreign5d: number; inst5d: number }>();
    invResults.forEach((r) => {
      if (r.status === "fulfilled") invMap.set(r.value.ticker, r.value);
    });
    analyzed.forEach((s) => {
      const inv = invMap.get(s.ticker);
      if (inv) { s.foreign5d = inv.foreign5d; s.inst5d = inv.inst5d; }
    });

    const categories = await generatePicks(analyzed);

    const result: PicksResponse = {
      categories,
      generatedAt: new Date().toISOString(),
    };
    _cache.set("picks", { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
