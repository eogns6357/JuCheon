import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import { POPULAR_STOCKS } from "@/lib/stocks";

interface Ticker { ticker: string; name: string; }

async function fetchTopByValue(market: "J" | "Q", count: number): Promise<Ticker[]> {
  try {
    const data = await kisGet(
      "/uapi/domestic-stock/v1/quotations/volume-rank",
      {
        FID_COND_MRKT_DIV_CODE: market,
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
    const rows = (data.output ?? data.output1 ?? []) as Record<string, string>[];
    return rows
      .slice(0, count)
      .map((r) => ({
        ticker: (r.stck_shrn_iscd ?? r.mksc_shrn_iscd ?? "").trim(),
        name: (r.hts_kor_isnm ?? r.prdt_name ?? "").trim(),
      }))
      .filter((t) => t.ticker && t.name);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const count = parseInt(req.nextUrl.searchParams.get("count") ?? "100");
  const half = Math.ceil(count / 2);

  const [kospi, kosdaq] = await Promise.all([
    fetchTopByValue("J", half),
    fetchTopByValue("Q", half),
  ]);

  // KOSPI/KOSDAQ 인터리브 병합 (중복 제거)
  const seen = new Set<string>();
  const tickers: Ticker[] = [];
  const maxLen = Math.max(kospi.length, kosdaq.length);
  for (let i = 0; i < maxLen && tickers.length < count; i++) {
    if (i < kospi.length && !seen.has(kospi[i].ticker)) {
      seen.add(kospi[i].ticker);
      tickers.push(kospi[i]);
    }
    if (i < kosdaq.length && !seen.has(kosdaq[i].ticker)) {
      seen.add(kosdaq[i].ticker);
      tickers.push(kosdaq[i]);
    }
  }

  // 장 마감 등 KIS 데이터 없을 때 POPULAR_STOCKS로 폴백
  if (tickers.length === 0) {
    const fallback = POPULAR_STOCKS
      .map((s) => ({ ticker: s.ticker, name: s.name }))
      .slice(0, count);
    return NextResponse.json({ tickers: fallback, total: fallback.length });
  }

  return NextResponse.json({ tickers, total: tickers.length });
}
