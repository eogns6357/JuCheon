import { NextRequest, NextResponse } from "next/server";
import { fetchDartDisclosures, isDartConfigured } from "@/lib/dart";
import { fetchNaverStockNews } from "@/lib/naver-news";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "005930";
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const dartConfigured = isDartConfigured();

  const [newsResult, dartResult] = await Promise.allSettled([
    fetchNaverStockNews(ticker, 20),
    dartConfigured ? fetchDartDisclosures({ ticker, corpName: name }) : Promise.resolve([]),
  ]);

  const items = newsResult.status === "fulfilled" ? newsResult.value : [];
  const newsError = newsResult.status === "rejected" ? String(newsResult.reason) : undefined;

  const disclosures = dartResult.status === "fulfilled" ? dartResult.value : [];
  const dartError = dartResult.status === "rejected" ? String(dartResult.reason) : undefined;

  return NextResponse.json({
    items,
    disclosures,
    newsSource: "naver",
    dartConfigured,
    ...(newsError ? { error: newsError } : {}),
    ...(dartError ? { dartError } : {}),
  });
}
