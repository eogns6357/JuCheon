import { NextRequest, NextResponse } from "next/server";

interface Ticker { ticker: string; name: string; }

// Module-level cache (shared in-process, refreshed every 6h)
let _cache: { data: Ticker[]; ts: number } | null = null;

async function getTickerList(origin: string): Promise<Ticker[]> {
  const now = Date.now();
  if (_cache && now - _cache.ts < 6 * 60 * 60 * 1000) return _cache.data;
  const res = await fetch(`${origin}/api/tickers?count=3000`);
  const json = await res.json();
  const data: Ticker[] = json.tickers ?? [];
  _cache = { data, ts: now };
  return data;
}

/**
 * Bidirectional English ↔ Korean equivalents for common company names/brands.
 * Each tuple: [english_lowercase, korean_string]
 */
const EQUIV: [string, string][] = [
  ["samsung", "삼성"],
  ["hyundai", "현대"],
  ["lotte", "롯데"],
  ["posco", "포스코"],
  ["kakao", "카카오"],
  ["naver", "네이버"],
  ["krafton", "크래프톤"],
  ["celltrion", "셀트리온"],
  ["gs", "지에스"],
  ["sk", "에스케이"],
  ["lg", "엘지"],
  ["kt", "케이티"],
  ["kb", "케이비"],
  ["nh", "엔에이치"],
  ["hana", "하나"],
  ["woori", "우리"],
  ["shinhan", "신한"],
  ["hanwha", "한화"],
  ["doosan", "두산"],
  ["daewoo", "대우"],
  ["ncsoft", "엔씨"],
  ["netmarble", "넷마블"],
  ["nexon", "넥슨"],
  ["kia", "기아"],
  ["kumho", "금호"],
  ["kogas", "한국가스"],
  ["kepco", "한국전력"],
  ["korail", "코레일"],
  ["cj", "씨제이"],
  ["oci", "오씨아이"],
  ["hy", "에이치와이"],
];

/** Returns all search terms to try for a given query (original + equivalents). */
function expandQuery(q: string): string[] {
  const terms = new Set<string>([q]);
  for (const [eng, kor] of EQUIV) {
    // English query → add Korean equivalent
    if (q.startsWith(eng) || eng.startsWith(q)) terms.add(kor);
    // Korean query → add English equivalent
    if (q.startsWith(kor) || kor.startsWith(q)) terms.add(eng);
  }
  return [...terms];
}

function searchStocks(stocks: Ticker[], query: string): Ticker[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const terms = expandQuery(q);

  const tier1: Ticker[] = []; // exact ticker
  const tier2: Ticker[] = []; // name or ticker starts with any term
  const tier3: Ticker[] = []; // name or ticker contains any term

  for (const s of stocks) {
    const nameLower = s.name.toLowerCase();
    const tickerLower = s.ticker.toLowerCase();

    if (tickerLower === q) { tier1.push(s); continue; }

    let matched2 = false;
    for (const t of terms) {
      if (nameLower.startsWith(t) || tickerLower.startsWith(t)) {
        tier2.push(s); matched2 = true; break;
      }
    }
    if (matched2) continue;

    for (const t of terms) {
      if (nameLower.includes(t) || tickerLower.includes(t)) {
        tier3.push(s); break;
      }
    }
  }

  return [...tier1, ...tier2, ...tier3];
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const tickers = await getTickerList(req.nextUrl.origin);
    const results = searchStocks(tickers, q).slice(0, 20);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
