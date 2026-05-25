export interface NaverNewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  time: string;
  url: string;
  imageUrl?: string;
}

function formatNaverDatetime(dt: string) {
  if (!dt || dt.length < 8) return { date: dt ?? "", time: "" };
  const date = `${dt.slice(0, 4)}.${dt.slice(4, 6)}.${dt.slice(6, 8)}`;
  const time = dt.length >= 12 ? `${dt.slice(8, 10)}:${dt.slice(10, 12)}` : "";
  return { date, time };
}

type NaverNewsGroup = {
  items?: Array<{
    id?: string;
    officeId?: string;
    articleId?: string;
    officeName?: string;
    datetime?: string;
    title?: string;
    titleFull?: string;
    mobileNewsUrl?: string;
    imageOriginLink?: string;
    photoType?: number;
  }>;
};

/** 네이버 금융(m.stock.naver.com) 종목 뉴스 — 공식 Open API 아님, 서버에서만 호출 */
export async function fetchNaverStockNews(
  ticker: string,
  limit = 20
): Promise<NaverNewsItem[]> {
  const code = ticker.replace(/\D/g, "").padStart(6, "0").slice(-6);
  if (code.length !== 6) return [];

  const res = await fetch(
    `https://m.stock.naver.com/api/news/stock/${code}?pageSize=${Math.min(limit, 30)}&page=1`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PersonalTrader/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    throw new Error(`네이버 금융 뉴스 조회 실패 (${res.status})`);
  }

  const data = (await res.json()) as NaverNewsGroup[];
  if (!Array.isArray(data)) return [];

  const seen = new Set<string>();
  const items: NaverNewsItem[] = [];

  for (const group of data) {
    const row = group.items?.[0];
    if (!row?.title) continue;

    const id = row.id ?? `${row.officeId ?? ""}_${row.articleId ?? ""}`;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const { date, time } = formatNaverDatetime(row.datetime ?? "");
    const url =
      row.mobileNewsUrl ??
      (row.officeId && row.articleId
        ? `https://n.news.naver.com/mnews/article/${row.officeId}/${row.articleId}`
        : "");

    items.push({
      id,
      title: (row.titleFull ?? row.title).trim(),
      source: row.officeName?.trim() || "네이버 뉴스",
      date,
      time,
      url,
      imageUrl: row.imageOriginLink?.trim() || undefined,
    });

    if (items.length >= limit) break;
  }

  return items;
}
