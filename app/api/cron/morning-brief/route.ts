import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import { formatDate, kisDateToISO } from "@/lib/stocks";
import { resolveGeminiModels, isRetryableGeminiError } from "@/lib/gemini-models";
import { calcIndicators, type OHLCV } from "@/lib/indicators";

export const maxDuration = 60;

// ── 보안: Vercel Cron은 Authorization: Bearer {CRON_SECRET} 헤더를 붙임 ──────
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 개발 환경 (미설정 시 허용)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── 미국 시장 (Yahoo Finance 비공식 API) ──────────────────────────────────────
interface USQuote {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePercent: number;
}

async function fetchUSMarket(): Promise<USQuote[]> {
  const symbols = [
    { symbol: "^GSPC",   label: "S&P500" },
    { symbol: "^IXIC",   label: "나스닥" },
    { symbol: "^DJI",    label: "다우존스" },
    { symbol: "USDKRW=X", label: "달러/원" },
  ];

  const results: USQuote[] = [];
  for (const { symbol, label } of symbols) {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      const price = meta.regularMarketPrice ?? 0;
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = price - prev;
      results.push({ symbol, label, price, change, changePercent: prev ? (change / prev) * 100 : 0 });
    } catch {
      // 개별 실패 무시
    }
  }
  return results;
}

// ── 미국 금융 뉴스 (Yahoo Finance RSS) ───────────────────────────────────────
interface USNewsItem { title: string; url: string; }

async function fetchUSNews(): Promise<USNewsItem[]> {
  const sources = [
    "https://finance.yahoo.com/rss/topstories",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", // WSJ Markets
  ];
  const items: USNewsItem[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    try {
      const res = await fetch(src, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      const xml = await res.text();
      const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const block of blocks) {
        const content = block[1];
        const titleM = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const linkM = content.match(/<link>(https?:\/\/[^<]+)<\/link>|<link\s[^>]*href="(https?:\/\/[^"]+)"/);
        const title = (titleM?.[1] ?? titleM?.[2] ?? "").trim();
        const url = (linkM?.[1] ?? linkM?.[2] ?? "").trim();
        if (title && !seen.has(title) && !title.toLowerCase().includes("yahoo") && !title.toLowerCase().includes("rss") && title.length > 10) {
          seen.add(title);
          items.push({ title, url });
        }
      }
    } catch { /* 개별 실패 무시 */ }
  }
  return items.slice(0, 15);
}

// ── 네이버 금융 시장 뉴스 ─────────────────────────────────────────────────────
interface NewsItem { title: string; date: string; }

async function fetchMarketNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      "https://m.stock.naver.com/api/news/market/domestic?pageSize=15&page=1",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json() as Array<{ items?: Array<{ titleFull?: string; title?: string; datetime?: string }> }>;
    if (!Array.isArray(data)) return [];
    return data
      .flatMap((g) => g.items ?? [])
      .filter((item) => item?.title)
      .slice(0, 12)
      .map((item) => ({
        title: (item.titleFull ?? item.title ?? "").trim(),
        date: item.datetime?.slice(0, 8) ?? "",
      }));
  } catch {
    return [];
  }
}

// ── DART 최근 공시 ────────────────────────────────────────────────────────────
interface DartItem { corpName: string; title: string; }

async function fetchRecentDart(): Promise<DartItem[]> {
  const key = process.env.DART_API_KEY;
  if (!key) return [];
  try {
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const res = await fetch(
      `https://opendart.fss.or.kr/api/list.json?crtfc_key=${key}&bgn_de=${yesterday}&end_de=${today}&sort=rcp_dt&sort_mth=desc&page_count=20`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    return (data.list ?? [])
      .filter((r: Record<string, string>) =>
        ["주요사항보고서", "유가증권발행실적보고서", "분기보고서", "사업보고서"].some((k) =>
          r.report_nm?.includes(k)
        )
      )
      .slice(0, 6)
      .map((r: Record<string, string>) => ({
        corpName: r.corp_name,
        title: r.report_nm,
      }));
  } catch {
    return [];
  }
}

// ── KIS 전일 거래량 상위 & 등락률 상위 ───────────────────────────────────────
interface KisStock { name: string; ticker: string; rate: number; }

async function fetchKisTopStocks(): Promise<{ gainers: KisStock[]; volume: KisStock[] }> {
  const empty = { gainers: [], volume: [] };
  try {
    const [gainerData, volumeData] = await Promise.allSettled([
      // 등락률 상위
      kisGet(
        "/uapi/domestic-stock/v1/ranking/fluctuation",
        {
          fid_rsfl_rate1: "3",
          fid_rsfl_rate2: "",
          fid_cond_mrkt_div_code: "J",
          fid_cond_scr_div_code: "20170",
          fid_input_iscd: "0000",
          fid_rank_sort_cls_code: "0",
          fid_input_cnt_1: "0",
          fid_prc_cls_code: "1",
          fid_input_price_1: "",
          fid_input_price_2: "",
          fid_vol_cnt: "",
          fid_trgt_cls_code: "0",
          fid_trgt_exls_cls_code: "0000000000",
          fid_div_cls_code: "0",
          fid_blng_cls_code: "0",
          fid_input_date_1: "",
        },
        "FHPST01710000"
      ),
      // 거래대금 상위
      kisGet(
        "/uapi/domestic-stock/v1/ranking/trading-volume",
        {
          fid_cond_mrkt_div_code: "J",
          fid_cond_scr_div_code: "20171",
          fid_input_iscd: "0000",
          fid_rank_sort_cls_code: "0",
          fid_input_cnt_1: "0",
          fid_input_price_1: "",
          fid_input_price_2: "",
          fid_vol_cnt: "",
          fid_trgt_cls_code: "0",
          fid_trgt_exls_cls_code: "0000000000",
          fid_div_cls_code: "0",
          fid_input_date_1: "",
        },
        "FHPST01720000"
      ),
    ]);

    const gainers: KisStock[] =
      gainerData.status === "fulfilled"
        ? (gainerData.value.output ?? []).slice(0, 5).map((r: Record<string, string>) => ({
            name: r.hts_kor_isnm?.trim() ?? "",
            ticker: r.mksc_shrn_iscd?.trim() ?? "",
            rate: parseFloat(r.prdy_ctrt ?? "0"),
          }))
        : [];

    const volume: KisStock[] =
      volumeData.status === "fulfilled"
        ? (volumeData.value.output ?? []).slice(0, 5).map((r: Record<string, string>) => ({
            name: r.hts_kor_isnm?.trim() ?? "",
            ticker: r.mksc_shrn_iscd?.trim() ?? "",
            rate: parseFloat(r.prdy_ctrt ?? "0"),
          }))
        : [];

    return { gainers, volume };
  } catch {
    return empty;
  }
}

// ── 기술적 선취매 후보 ─────────────────────────────────────────────────────────
interface TechnicalPick {
  name: string;
  ticker: string;
  close: number;
  rsi: number;
  volRatio: number;
  ret1d: number;
  setup: string; // 감지된 시그널 요약
}

async function fetchOHLCV(ticker: string): Promise<OHLCV[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 50);
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
}

async function fetchTechnicalPicks(stocks: KisStock[]): Promise<TechnicalPick[]> {
  const results = await Promise.allSettled(
    stocks.slice(0, 15).map(async (stock) => {
      const ohlcv = await fetchOHLCV(stock.ticker);
      if (ohlcv.length < 26) return null;

      const withInd = calcIndicators(ohlcv);
      const last = withInd[withInd.length - 1];
      const prev = withInd[withInd.length - 2];
      if (!last || !prev) return null;

      const rsi     = last.rsi ?? 50;
      const ma5     = last.ma5 ?? last.close;
      const ma20    = last.ma20 ?? last.close;
      const prevMa5 = prev.ma5 ?? ma5;
      const prevMa20= prev.ma20 ?? ma20;
      const avgVol  = ohlcv.slice(-21, -1).reduce((s, r) => s + r.volume, 0) / 20;
      const volRatio= avgVol > 0 ? last.volume / avgVol : 1;
      const ret1d   = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

      const signals: string[] = [];
      if (last.close > ma20)                      signals.push("MA20 위");
      if (ma5 > ma20 && prevMa5 <= prevMa20)       signals.push("골든크로스 발생");
      if (rsi >= 40 && rsi <= 65)                  signals.push(`RSI ${rsi.toFixed(0)}`);
      if (volRatio >= 1.5)                         signals.push(`거래량 ${volRatio.toFixed(1)}배`);
      if (last.macd && last.macd.histogram > 0)    signals.push("MACD 양전환");
      if (last.macd && last.macd.MACD > last.macd.signal &&
          prev.macd && prev.macd.MACD <= prev.macd.signal) signals.push("MACD 크로스");
      const high20 = Math.max(...ohlcv.slice(-20).map((r) => r.close));
      const pullback = ((last.close - high20) / high20) * 100;
      if (pullback > -12 && pullback < -3 && last.close > (last.ma60 ?? 0)) signals.push("눌림목");

      if (signals.length < 2) return null;

      return {
        name: stock.name,
        ticker: stock.ticker,
        close: last.close,
        rsi,
        volRatio,
        ret1d,
        setup: signals.join(" · "),
      } satisfies TechnicalPick;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<TechnicalPick> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value)
    .slice(0, 5);
}

// ── Gemini로 브리핑 생성 ──────────────────────────────────────────────────────
async function generateBriefing(
  usMarket: USQuote[],
  usNews: USNewsItem[],
  krNews: NewsItem[],
  dart: DartItem[],
  gainers: KisStock[],
  volume: KisStock[],
  technicalPicks: TechnicalPick[],
): Promise<string> {
  const usLines = usMarket
    .map((q) => `${q.label}: ${q.price.toLocaleString()} (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)`)
    .join("\n");

  const usNewsLines = usNews.map((n, i) => `${i + 1}. ${n.title}${n.url ? `\n   URL: ${n.url}` : ""}`).join("\n");
  const krNewsLines = krNews.map((n, i) => `${i + 1}. ${n.title}`).join("\n");
  const dartLines = dart.length
    ? dart.map((d) => `- ${d.corpName}: ${d.title}`).join("\n")
    : "없음";
  const gainerLines = gainers.map((s) => `${s.name}(${s.ticker}) +${s.rate.toFixed(1)}%`).join(", ");
  const volumeLines = volume.map((s) => `${s.name}(${s.ticker})`).join(", ");

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const techLines = technicalPicks.length
    ? technicalPicks.map((p) =>
        `${p.name}(${p.ticker}) | 종가 ${p.close.toLocaleString()}원 | 전일 ${p.ret1d >= 0 ? "+" : ""}${p.ret1d.toFixed(1)}% | 거래량 ${p.volRatio.toFixed(1)}배 | RSI ${p.rsi.toFixed(0)} | 시그널: ${p.setup}`
      ).join("\n")
    : "없음";

  const prompt = `당신은 한국 주식 단기 매매 전문 트레이더입니다.
아래 데이터를 분석해서 오늘 ${today} 장에서 실제로 매매에 활용할 수 있는 브리핑을 작성하세요.
핵심 목표: 오늘 오르기 전에 살 수 있는 종목을 미리 짚어주는 것.

=== [A] 기술적 선취매 후보 (전일 종가 기준 지표 계산 완료) ===
${techLines}

=== [B] 미국 시장 마감 ===
${usLines || "데이터 없음"}

=== [C] 미국·글로벌 주요 뉴스 (밤사이) ===
${usNewsLines || "없음"}

=== [D] 국내 주요 공시 (DART) ===
${dartLines}

=== [E] 전일 등락률 상위 / 거래대금 상위 ===
등락률: ${gainerLines || "없음"}
거래대금: ${volumeLines || "없음"}

=== [F] 국내 주요 뉴스 ===
${krNewsLines || "없음"}

【출력 형식 — 반드시 이 순서대로】

<b>📊 오늘 장 분위기</b>
미국 지수 흐름 → KOSPI/KOSDAQ 출발 방향(강세/약세/혼조) 두 줄. 근거 명확히.

<b>⭐ 오늘 선취매 후보</b>
[A] 기술적 선취매 후보 중, 오늘 9:00~9:30 시초가 부근에서 선취매할 만한 종목 1~2개를 골라주세요.
선정 기준: MA20 위 + MACD 양전환 + 거래량 증가 + 뉴스·공시 촉매 유무 종합 판단.
후보가 없으면 전일 거래대금 상위 중 기술적으로 가장 나은 종목을 대신 제시.

형식:
① <b>종목명</b>(종목코드) — 선택 이유 한 줄
② 진입: 시초가/눌림 조건 | 목표: +N% | 손절: -N%
③ 주의사항 한 줄

<b>🎯 오늘 매매 아이디어</b>
이슈·뉴스·공시 기반 아이디어 2개 (선취매 후보와 겹쳐도 무방).

▶ [1] 뉴스·공시 촉매 (9:00~9:20 선취매)
[B][C][D]에서 국내 주가 직접 영향 이슈 1개. 없으면 "현재는 관련 전달 내용이 없습니다." 후 [2]로 보완.

▶ [2] 모멘텀 연속 (전일 강세 추적)
전일 거래대금·등락률 상위 중 오늘 추가 상승 여력 종목.

각 아이디어 형식:
① 이슈 한 줄
② <b>종목명</b>(종목코드) — 이유 한 줄
③ 진입 타이밍 / 목표 / 손절 한 줄

<b>⚡ 오늘 한 줄 전략</b>
장 전체 방향 + 오늘 포지션 방향 한 줄.

<b>📎 참고 자료</b>
핵심 뉴스 기사 2~3개. <a href="URL">제목 (출처)</a>
(제공된 URL만 사용. 임의 생성 금지. URL 없으면 생략.)

【작성 규칙】
- 텔레그램 HTML (<b>볼드</b>, <a href="...">링크</a>만 허용, 마크다운 금지)
- 총 2000자 이내
- 확신 있게 직접 작성. 수익 보장 표현 금지. 마지막 줄 "투자 판단은 본인 책임" 필수`;

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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (text) return text;
  }
  throw new Error("AI 브리핑 생성 실패");
}

// ── 텔레그램 발송 ─────────────────────────────────────────────────────────────
async function sendTelegram(text: string, token: string, chatId: string) {
  // Telegram 메시지 4096자 제한 — 초과 시 분할 발송
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 4000) chunks.push(text.slice(i, i + 4000));

  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
    });
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ error: "TELEGRAM_TOKEN / TELEGRAM_CHAT_ID 미설정" }, { status: 500 });
  }

  try {
    // 병렬 데이터 수집
    const [usMarket, usNews, krNews, dart, topStocks] = await Promise.all([
      fetchUSMarket(),
      fetchUSNews(),
      fetchMarketNews(),
      fetchRecentDart(),
      fetchKisTopStocks(),
    ]);

    // 기술적 선취매 후보: 거래대금 상위 종목 지표 계산
    const allStocks = [
      ...topStocks.volume,
      ...topStocks.gainers.filter((g) => !topStocks.volume.some((v) => v.ticker === g.ticker)),
    ];
    const technicalPicks = await fetchTechnicalPicks(allStocks);

    const briefing = await generateBriefing(
      usMarket, usNews, krNews, dart, topStocks.gainers, topStocks.volume, technicalPicks
    );

    const today = new Date().toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short",
    });

    const header = `안녕하세요 주천봇입니다 🙂\n\n🌅 <b>주천 모닝 브리핑</b> — ${today}\n${"─".repeat(28)}\n\n`;
    const footer = `\n\n${"─".repeat(28)}\n⚠️ 본 내용은 투자 참고용이며, 최종 판단은 본인 책임입니다.`;

    await sendTelegram(header + briefing + footer, token, chatId);

    return NextResponse.json({ ok: true, length: briefing.length });
  } catch (e) {
    console.error("[morning-brief]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
