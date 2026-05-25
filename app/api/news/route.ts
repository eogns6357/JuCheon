import { NextRequest, NextResponse } from "next/server";
import { fetchDartDisclosures, isDartConfigured } from "@/lib/dart";
import { fetchNaverStockNews } from "@/lib/naver-news";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "005930";
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const dartConfigured = isDartConfigured();

  try {
    let items: Awaited<ReturnType<typeof fetchNaverStockNews>> = [];
    let newsError: string | undefined;
    let newsSource = "naver";

    try {
      items = await fetchNaverStockNews(ticker, 20);
    } catch (e) {
      newsError = String(e);
    }

    let disclosures: Awaited<ReturnType<typeof fetchDartDisclosures>> = [];
    let dartError: string | undefined;
    if (dartConfigured && ticker) {
      try {
        disclosures = await fetchDartDisclosures({ ticker, corpName: name });
      } catch (e) {
        dartError = String(e);
      }
    }

    return NextResponse.json({
      items,
      disclosures,
      newsSource,
      dartConfigured,
      ...(newsError ? { error: newsError } : {}),
      ...(dartError ? { dartError } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [], disclosures: [] }, { status: 500 });
  }
}
