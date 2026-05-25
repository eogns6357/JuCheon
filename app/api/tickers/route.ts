import { NextRequest, NextResponse } from "next/server";
import { STOCKS } from "@/lib/stocks";

export async function GET(req: NextRequest) {
  const count = parseInt(req.nextUrl.searchParams.get("count") ?? "200");
  const tickers = STOCKS.map((s) => ({ ticker: s.ticker, name: s.name })).slice(0, count);
  return NextResponse.json({ tickers, total: tickers.length });
}
