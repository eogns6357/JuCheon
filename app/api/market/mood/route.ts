import { NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import {
  loadMoodSnapshot,
  saveMoodSnapshot,
  withStale,
  type MarketStock,
  type MoodData,
} from "@/lib/market-mood-snapshot";

export type { MarketStock, MoodData };

const _cache = new Map<string, { data: MoodData; ts: number }>();
const TTL = 60 * 1000;

/** 유동성 최소 거래대금 10억 원 (screener와 동일) */
const MIN_TRADE_VALUE = 1_000_000_000;

interface ParsedRow {
  ticker: string;
  name: string;
  price: number;
  change: number;
  rate: number;
  volume: number;
  tradeValue: number;
}

function mapRow(r: Record<string, string>): ParsedRow | null {
  const ticker = (r.stck_shrn_iscd ?? r.mksc_shrn_iscd ?? "").trim();
  if (!ticker) return null;

  const sign = r.prdy_vrss_sign ?? "3";
  const neg = sign === "4" || sign === "5";
  const name = (r.hts_kor_isnm ?? r.prdt_name ?? "").trim();
  const volume = parseInt(r.acml_vol ?? "0", 10);
  const tradeValue = parseInt(r.acml_tr_pbmn ?? "0", 10);

  return {
    ticker,
    name: name || ticker,
    price: parseInt(r.stck_prpr ?? "0", 10),
    change: neg ? -Math.abs(parseInt(r.prdy_vrss ?? "0", 10)) : Math.abs(parseInt(r.prdy_vrss ?? "0", 10)),
    rate: neg ? -Math.abs(parseFloat(r.prdy_ctrt ?? "0")) : Math.abs(parseFloat(r.prdy_ctrt ?? "0")),
    volume,
    tradeValue,
  };
}

function extractRows(data: unknown): Record<string, string>[] {
  const d = data as { output?: unknown; output1?: unknown; output2?: unknown };
  const arr = d.output ?? d.output1 ?? d.output2;
  if (!Array.isArray(arr)) return [];
  return arr as Record<string, string>[];
}

function parseRows(data: unknown): ParsedRow[] {
  return extractRows(data)
    .map(mapRow)
    .filter((s): s is ParsedRow => s !== null);
}

function assertKisOk(data: unknown, label: string) {
  const d = data as { rt_cd?: string; msg1?: string };
  if (d.rt_cd && d.rt_cd !== "0") {
    throw new Error(`${label}: ${d.msg1 ?? `rt_cd ${d.rt_cd}`}`);
  }
}

function mergeRow(into: Map<string, ParsedRow>, row: ParsedRow) {
  const prev = into.get(row.ticker);
  if (!prev) {
    into.set(row.ticker, row);
    return;
  }
  into.set(row.ticker, {
    ...prev,
    volume: Math.max(prev.volume, row.volume),
    tradeValue: Math.max(prev.tradeValue, row.tradeValue),
    price: row.price || prev.price,
    rate: row.rate ?? prev.rate,
    change: row.change ?? prev.change,
  });
}

/** 거래량·거래대금 정규화 후 기하평균으로 복합 순위 (둘 다 높을수록 상위) */
function rankByVolumeAndAmount(rows: ParsedRow[]): MarketStock[] {
  const eligible = rows.filter((r) => r.volume > 0 && r.tradeValue >= MIN_TRADE_VALUE);
  if (eligible.length === 0) return [];

  const maxVol = Math.max(...eligible.map((r) => r.volume));
  const maxAmt = Math.max(...eligible.map((r) => r.tradeValue));

  return eligible
    .map((r) => ({
      ...r,
      score: Math.sqrt((r.volume / maxVol) * (r.tradeValue / maxAmt)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ ticker, name, price, change, rate, volume, tradeValue }) => ({
      ticker,
      name,
      price,
      change,
      rate,
      volume,
      tradeValue,
    }));
}

const BASE_PARAMS = {
  FID_TRGT_CLS_CODE: "111111111",
  FID_TRGT_EXLS_CLS_CODE: "0000000000",
  FID_INPUT_PRICE_1: "",
  FID_INPUT_PRICE_2: "",
  FID_VOL_CNT: "",
  FID_INPUT_DATE_1: "",
};

const VOLUME_PATHS = [
  "/uapi/domestic-stock/v1/quotations/volume-rank",
  "/uapi/domestic-stock/v1/ranking/volume",
] as const;

async function fetchRankingRows(blngCode: "0" | "3"): Promise<ParsedRow[]> {
  const params = {
    ...BASE_PARAMS,
    FID_BLNG_CLS_CODE: blngCode,
    FID_COND_MRKT_DIV_CODE: "J",
    FID_COND_SCR_DIV_CODE: "20171",
    FID_INPUT_ISCD: "0000",
    FID_DIV_CLS_CODE: "0",
  };

  for (const path of VOLUME_PATHS) {
    const data = await kisGet(path, params, "FHPST01710000");
    assertKisOk(data, blngCode === "0" ? "거래량순위" : "거래대금순위");
    const rows = parseRows(data);
    if (rows.length > 0) return rows;
  }
  return [];
}

/** 거래량순·거래대금순 API를 합쳐 풀을 만든 뒤 복합 점수로 30종목 선정 */
async function fetchVolumeRank(): Promise<MarketStock[]> {
  const pool = new Map<string, ParsedRow>();

  const results = await Promise.allSettled([
    fetchRankingRows("0"),
    fetchRankingRows("3"),
  ]);

  for (const res of results) {
    if (res.status === "fulfilled") {
      for (const row of res.value) mergeRow(pool, row);
    }
  }

  const ranked = rankByVolumeAndAmount([...pool.values()]);
  if (ranked.length > 0) return ranked;

  // 복합 필터에 걸리면 거래대금순 상위만이라도 반환
  const fallback = [...pool.values()]
    .filter((r) => r.tradeValue > 0)
    .sort((a, b) => b.tradeValue - a.tradeValue)
    .slice(0, 30)
    .map(({ ticker, name, price, change, rate, volume, tradeValue }) => ({
      ticker,
      name,
      price,
      change,
      rate,
      volume,
      tradeValue,
    }));

  if (fallback.length > 0) return fallback;
  throw new Error("거래량·거래대금 순위: 응답 데이터 없음");
}

async function fetchMoodLive(fallback?: { gainers: MarketStock[]; losers: MarketStock[] }): Promise<MoodData> {
  const volume30 = await fetchVolumeRank();

  let gainers = fallback?.gainers ?? [];
  let losers = fallback?.losers ?? [];

  try {
    const [gainData, loseData] = await Promise.all([
      kisGet(
        "/uapi/domestic-stock/v1/ranking/fluctuation",
        {
          ...BASE_PARAMS,
          FID_BLNG_CLS_CODE: "0",
          FID_COND_MRKT_DIV_CODE: "J",
          FID_COND_SCR_DIV_CODE: "20170",
          FID_INPUT_ISCD: "0000",
          FID_DIV_CLS_CODE: "1",
          FID_VOL_CNT: "100000",
          FID_INPUT_PRICE_1: "1000",
        },
        "FHPST01760000"
      ),
      kisGet(
        "/uapi/domestic-stock/v1/ranking/fluctuation",
        {
          ...BASE_PARAMS,
          FID_BLNG_CLS_CODE: "0",
          FID_COND_MRKT_DIV_CODE: "J",
          FID_COND_SCR_DIV_CODE: "20170",
          FID_INPUT_ISCD: "0000",
          FID_DIV_CLS_CODE: "2",
          FID_VOL_CNT: "100000",
          FID_INPUT_PRICE_1: "1000",
        },
        "FHPST01760000"
      ),
    ]);
    assertKisOk(gainData, "상승률순위");
    assertKisOk(loseData, "하락률순위");
    gainers = parseRows(gainData).slice(0, 10) as MarketStock[];
    losers = parseRows(loseData).slice(0, 10) as MarketStock[];
  } catch {
    // 장 마감 시 등락률 순위만 실패할 수 있음
  }

  return { volume30, gainers, losers };
}

export async function GET() {
  const hit = _cache.get("mood");
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data);
  }

  const snapshot = await loadMoodSnapshot();

  try {
    const result = await fetchMoodLive(
      snapshot ? { gainers: snapshot.gainers, losers: snapshot.losers } : undefined
    );
    try { await saveMoodSnapshot(result); } catch { /* Vercel read-only filesystem */ }
    _cache.set("mood", { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (e) {
    if (snapshot) {
      const stale = withStale(snapshot);
      _cache.set("mood", { data: stale, ts: Date.now() });
      return NextResponse.json(stale);
    }
    return NextResponse.json(
      { error: String(e), volume30: [], gainers: [], losers: [] },
      { status: 500 }
    );
  }
}
