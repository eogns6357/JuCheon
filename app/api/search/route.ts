import { NextRequest, NextResponse } from "next/server";
import { POPULAR_STOCKS } from "@/lib/stocks";

interface Ticker { ticker: string; name: string; }

interface NaverACItem {
  code: string;
  name: string;
  typeCode?: string;
  nationCode?: string;
}

async function searchNaverAC(q: string): Promise<Ticker[]> {
  const res = await fetch(
    `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PersonalTrader/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4000),
    }
  );
  if (!res.ok) return [];
  const data = await res.json() as { items?: NaverACItem[] };
  return (data.items ?? [])
    .filter((item) => item.nationCode === "KOR" && /^\d{6}$/.test(item.code))
    .map((item) => ({ ticker: item.code.trim(), name: item.name.trim() }));
}

function searchLocal(q: string): Ticker[] {
  const term = q.toLowerCase();
  return POPULAR_STOCKS.filter(
    (s) => s.name.includes(term) || s.ticker.includes(term)
  ).map((s) => ({ ticker: s.ticker, name: s.name }));
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await searchNaverAC(q);
    if (results.length > 0) return NextResponse.json({ results: results.slice(0, 20) });
  } catch { /* fall through */ }

  return NextResponse.json({ results: searchLocal(q).slice(0, 20) });
}
