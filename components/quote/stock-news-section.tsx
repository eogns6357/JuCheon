"use client";

import { useState } from "react";
import useSWR from "swr";
import { NewsCard, NewsCardSkeleton, type NewsCardItem } from "@/components/quote/news-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DisclosureItem {
  corpName: string;
  title: string;
  date: string;
  submitter: string;
  url: string;
}

export function StockNewsSection({ ticker, name }: { ticker: string; name: string }) {
  const [tab, setTab] = useState<"news" | "disclosure">("news");
  const query = name ? `&name=${encodeURIComponent(name)}` : "";
  const { data, isLoading, error } = useSWR(
    ticker ? `/api/news?ticker=${ticker}${query}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const items: NewsCardItem[] = data?.items ?? [];
  const disclosures: DisclosureItem[] = data?.disclosures ?? [];
  const dartConfigured = data?.dartConfigured ?? false;

  return (
    <section className="mt-4">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f5]">
          <h3 className="text-sm font-semibold text-[#191919]">뉴스 · 공시</h3>
          <p className="text-xs text-[#b0b0b8] mt-0.5">
            {name || ticker} · 뉴스는 네이버 금융 기준
          </p>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-[#f0f0f5]">
          {(
            [
              { id: "news" as const, label: "뉴스", count: items.length },
              { id: "disclosure" as const, label: "공시", count: disclosures.length },
            ] as const
          ).map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-[#191919] text-white"
                  : "bg-[#f0f0f5] text-[#555] hover:bg-[#e8e8ed]"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1 num ${tab === id ? "text-white/70" : "text-[#b0b0b8]"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        ) : tab === "news" ? (
          items.length === 0 ? (
            <p className="text-center text-sm text-[#b0b0b8] py-10">
              {data?.error || error ? "뉴스를 불러오지 못했습니다." : "관련 뉴스가 없습니다."}
            </p>
          ) : (
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {items.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          )
        ) : disclosures.length === 0 ? (
          <p className="text-center text-sm text-[#b0b0b8] py-10 px-5 leading-relaxed">
            {!dartConfigured
              ? "공시는 .env.local에 DART_API_KEY를 넣으면 조회됩니다. (opendart.fss.or.kr 무료 발급)"
              : data?.dartError
                ? `공시 조회 오류: ${data.dartError}`
                : "최근 30일 공시가 없습니다."}
          </p>
        ) : (
          <ul className="divide-y divide-[#f0f0f5]">
            {disclosures.map((item, i) => (
              <li key={item.url || i} className="px-5 py-4 hover:bg-[#fafafa]">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#3182f6] leading-snug mb-1 block hover:underline"
                >
                  {item.title}
                </a>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#b0b0b8]">
                  <span>{item.date}</span>
                  {item.submitter && (
                    <>
                      <span>·</span>
                      <span>{item.submitter}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
