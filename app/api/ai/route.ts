import { NextRequest, NextResponse } from "next/server";
import { resolveGeminiModels, isRetryableGeminiError } from "@/lib/gemini-models";
import { kisGet } from "@/lib/kis";
import { calcIndicators, signalScore, type OHLCV } from "@/lib/indicators";
import { formatDate, kisDateToISO } from "@/lib/stocks";
import { fetchNaverStockNews } from "@/lib/naver-news";

export async function POST(req: NextRequest) {
  const { ticker, name } = await req.json();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 200);

    const chartData = await kisGet(
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

    const ohlcv: OHLCV[] = (chartData.output2 ?? [])
      .filter((r: Record<string, string>) => r.stck_bsop_date)
      .reverse()
      .map((r: Record<string, string>) => ({
        date: kisDateToISO(r.stck_bsop_date),
        open: parseInt(r.stck_oprc, 10),
        high: parseInt(r.stck_hgpr, 10),
        low: parseInt(r.stck_lwpr, 10),
        close: parseInt(r.stck_clpr, 10),
        volume: parseInt(r.acml_vol, 10),
      }));

    if (ohlcv.length < 30) {
      return NextResponse.json({ error: "데이터 부족" }, { status: 400 });
    }

    const withInd = calcIndicators(ohlcv);
    const score = signalScore(withInd);
    const last = withInd[withInd.length - 1];
    const prev5 = ohlcv.slice(-6, -1);
    const avgVol5 = prev5.reduce((s, r) => s + r.volume, 0) / 5;
    const volRatio = avgVol5 > 0 ? last.volume / avgVol5 : 0;

    // 수급 + 뉴스 병렬 fetch
    const invEnd = new Date();
    const invStart = new Date();
    invStart.setDate(invStart.getDate() - 15);

    const [invResult, newsResult] = await Promise.allSettled([
      kisGet(
        "/uapi/domestic-stock/v1/quotations/inquire-investor",
        {
          FID_COND_MRKT_DIV_CODE: "J",
          FID_INPUT_ISCD: ticker,
          FID_INPUT_DATE_1: formatDate(invStart),
          FID_INPUT_DATE_2: formatDate(invEnd),
        },
        "FHKST01010900"
      ),
      fetchNaverStockNews(ticker, 5),
    ]);

    let foreign5d = 0;
    let inst5d = 0;
    if (invResult.status === "fulfilled") {
      const invRows = ((invResult.value.output2 ?? []) as Record<string, string>[]).slice(0, 5);
      foreign5d = invRows.reduce((s, r) => s + parseInt(r.frgn_ntby_qty ?? "0", 10), 0);
      inst5d = invRows.reduce((s, r) => s + parseInt(r.orgn_ntby_qty ?? "0", 10), 0);
    }

    const newsHeadlines: string[] = newsResult.status === "fulfilled"
      ? newsResult.value.slice(0, 5).map((n) => `[${n.date}] ${n.title}`)
      : [];

    const summary = {
      name: name ?? ticker,
      ticker,
      date: last.date,
      close: last.close,
      rsi: last.rsi?.toFixed(1),
      macd: last.macd?.MACD.toFixed(0),
      macdSignal: last.macd?.signal.toFixed(0),
      macdHist: last.macd?.histogram.toFixed(0),
      bb_upper: last.bb?.upper.toFixed(0),
      bb_middle: last.bb?.middle.toFixed(0),
      bb_lower: last.bb?.lower.toFixed(0),
      ma5: last.ma5?.toFixed(0),
      ma20: last.ma20?.toFixed(0),
      ma60: last.ma60?.toFixed(0),
      atr: last.atr?.toFixed(0),
      volRatio: volRatio.toFixed(2),
      score,
      foreign5d,
      inst5d,
    };

    const investorLine = foreign5d !== 0 || inst5d !== 0
      ? `• 수급 (최근 5거래일): 외국인 ${foreign5d > 0 ? "+" : ""}${foreign5d.toLocaleString()}주 / 기관 ${inst5d > 0 ? "+" : ""}${inst5d.toLocaleString()}주`
      : "";

    const newsLine = newsHeadlines.length > 0
      ? `• 최근 뉴스 헤드라인:\n${newsHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`
      : "";

    const prompt = `당신은 한국 주식 단기 매매 전문가입니다.
아래는 ${summary.name}(${summary.ticker})의 기술적 지표, 수급, 뉴스 정보입니다.

• 현재가: ${summary.close?.toLocaleString()}원
• RSI(14): ${summary.rsi}
• MACD: ${summary.macd} / 시그널: ${summary.macdSignal} / 히스토그램: ${summary.macdHist}
• 볼린저밴드: 상단 ${summary.bb_upper} / 중간 ${summary.bb_middle} / 하단 ${summary.bb_lower}
• 이동평균: MA5 ${summary.ma5} / MA20 ${summary.ma20} / MA60 ${summary.ma60}
• ATR(14): ${summary.atr}
• 거래량 비율(5일 평균 대비): ${summary.volRatio}배
${investorLine}
${newsLine}
• 종합 시그널 점수: ${summary.score}/100

다음을 한국어로 간결하게 분석해주세요 (총 400자 이내):
1. 현재 추세 (상승/하락/횡보)
2. 수급 및 뉴스 영향 해석
3. 단기 매매 전략 제안 (진입 조건, 손절 기준)`;

    const MODELS = resolveGeminiModels();

    let analysis = "";
    let modelUsed = "";
    let lastError = "";

    for (const model of MODELS) {
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
        lastError = `[${model}] ${data.error.message ?? data.error.status}`;
        if (isRetryableGeminiError(data.error)) continue;
        return NextResponse.json({ error: lastError }, { status: res.status });
      }

      analysis = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (analysis) {
        modelUsed = model;
        break;
      }
    }

    if (!analysis) {
      const busy = lastError.toLowerCase().includes("high demand") || lastError.includes("429");
      const message = busy
        ? "AI 서버가 일시적으로 혼잡합니다. 1~2분 후 다시 시도해 주세요."
        : `AI 분석을 완료하지 못했습니다. ${lastError || "모든 모델 응답 없음"}`;
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ analysis, summary, score, model: modelUsed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
