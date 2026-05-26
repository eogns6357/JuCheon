import { NextRequest, NextResponse } from "next/server";
import { resolveGeminiModels, isRetryableGeminiError } from "@/lib/gemini-models";

export const maxDuration = 60;

// ── 캐시 (1시간) ─────────────────────────────────────────────────────────────
const _cache = new Map<string, { data: PicksResponse; ts: number }>();
const TTL = 60 * 60 * 1000;

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
}

// ── Gemini 추천 생성 ──────────────────────────────────────────────────────────
async function generatePicks(stockLines: string): Promise<PickCategory[]> {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
  });

  const prompt = `당신은 한국 주식 단기 매매 전문 트레이더입니다.
아래 ${today} 기준 실시간 시장 데이터를 분석해서, 4개 투자 영역으로 나눠 각 3종목씩 추천하세요.

[시장 데이터 — 거래량·거래대금 상위 + 등락률 상위/하위]
${stockLines}

[4개 영역]
1. momentum — 단기 모멘텀: 거래량·거래대금 상위이면서 당일 강한 상승 종목
2. supply — 수급 집중: 외국인·기관이 집중 매수하는 것으로 보이는 대형주
3. bounce — 기술적 반등: 최근 하락 후 반등 가능성 있는 종목 (하락률 상위 중 낙폭과대)
4. theme — 테마 주도: 섹터 모멘텀이 강하고 추가 상승 여력 있는 주도 종목

[출력 규칙]
- 반드시 JSON만 출력. 마크다운 코드블록 없이 순수 JSON.
- 각 영역에 데이터에 있는 종목 중 가장 적합한 3개 선정
- 동일 종목은 4개 영역에 걸쳐 절대 중복 사용 금지 (총 12개 종목 모두 달라야 함)
- reason: 지금 이 종목을 매수해야 하는 이유 2문장 (구체적 수치 포함)
- signals: 핵심 근거 3개 (예: "거래대금 1위 · 전일 +4.2% · 거래량 3.1배")
- entry: 진입 방법 (예: "시초가 확인 후 +1% 이내" 또는 "눌림 지지 확인 후")
- target: 목표 수익률 (예: "+4~6%")
- stop: 손절 기준 (예: "-2% 이탈 시")

{"categories":[{"id":"momentum","title":"단기 모멘텀","emoji":"🚀","description":"거래량 폭발과 강한 상승세가 동시에 나타나는 종목","stocks":[{"ticker":"...","name":"...","reason":"...","signals":"...","entry":"...","target":"...","stop":"..."},{"ticker":"...","name":"...","reason":"...","signals":"...","entry":"...","target":"...","stop":"..."},{"ticker":"...","name":"...","reason":"...","signals":"...","entry":"...","target":"...","stop":"..."}]},{"id":"supply","title":"수급 집중","emoji":"💰","description":"스마트머니가 집중 매수하는 종목","stocks":[...]},{"id":"bounce","title":"기술적 반등","emoji":"📈","description":"단기 낙폭과대 후 반등 셋업이 완성된 종목","stocks":[...]},{"id":"theme","title":"테마 주도","emoji":"⚡","description":"섹터를 이끄는 강한 모멘텀 주도 종목","stocks":[...]}]}`;

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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;
    const parsed = JSON.parse(jsonMatch[0]) as { categories: PickCategory[] };
    return parsed.categories ?? [];
  }
  throw new Error("AI 추천 생성 실패");
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const hit = _cache.get("picks");
  if (!force && hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data);
  }

  try {
    // market/mood는 자체 캐시(60s)가 있어서 추가 KIS 호출 없음
    const moodRes = await fetch(`${req.nextUrl.origin}/api/market/mood`);
    const mood = await moodRes.json() as {
      volume30?: { ticker: string; name: string; price: number; rate: number; volume: number; tradeValue: number }[];
      gainers?:  { ticker: string; name: string; price: number; rate: number }[];
      losers?:   { ticker: string; name: string; price: number; rate: number }[];
    };

    const volume30 = mood.volume30 ?? [];
    const gainers  = mood.gainers  ?? [];
    const losers   = mood.losers   ?? [];

    const volLines = volume30.slice(0, 20).map((s, i) =>
      `[거래량${i + 1}위] ${s.name}(${s.ticker}) 종가 ${s.price.toLocaleString()}원 ${s.rate >= 0 ? "+" : ""}${s.rate.toFixed(2)}% 거래대금 ${Math.round(s.tradeValue / 1e8)}억`
    ).join("\n");

    const gainerLines = gainers.slice(0, 5).map((s) =>
      `[상승] ${s.name}(${s.ticker}) ${s.rate >= 0 ? "+" : ""}${s.rate.toFixed(2)}% 종가 ${s.price.toLocaleString()}원`
    ).join("\n");

    const loserLines = losers.slice(0, 5).map((s) =>
      `[하락] ${s.name}(${s.ticker}) ${s.rate.toFixed(2)}% 종가 ${s.price.toLocaleString()}원`
    ).join("\n");

    const stockLines = [volLines, gainerLines, loserLines].filter(Boolean).join("\n");

    const categories = await generatePicks(stockLines);
    const result: PicksResponse = { categories, generatedAt: new Date().toISOString() };
    _cache.set("picks", { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
