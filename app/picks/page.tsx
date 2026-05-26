"use client";

import { useState } from "react";
import useSWR from "swr";
import { fmt, signColor } from "@/lib/stocks";
import type { PicksResponse, PickCategory, StockPick } from "@/app/api/ai/picks/route";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const json = await r.json();
  if (!r.ok || json?.error) throw new Error(json?.error ?? `HTTP ${r.status}`);
  return json;
};

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[#f0f0f5]">
        <div className="h-5 w-32 bg-[#f0f0f5] rounded animate-pulse mb-2" />
        <div className="h-3 w-48 bg-[#f0f0f5] rounded animate-pulse" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="p-4 border-b border-[#f0f0f5] last:border-0 space-y-2">
          <div className="h-4 w-28 bg-[#f0f0f5] rounded animate-pulse" />
          <div className="h-3 w-full bg-[#f0f0f5] rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-[#f0f0f5] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function StockCard({ stock, rank }: { stock: StockPick; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-[#f0f0f5] last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-[#fafafa] transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#3182f6] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
            {rank}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-[#191919]">{stock.name}</span>
              <span className="text-[11px] text-[#b0b0b8] num">{stock.ticker}</span>
            </div>
            <p className="text-xs text-[#7b7b7b] line-clamp-2 leading-relaxed">{stock.reason}</p>
          </div>
          <span className="shrink-0 text-[#b0b0b8] text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="bg-[#f5f8ff] rounded-xl px-3 py-2">
            <p className="text-[11px] text-[#3182f6] font-semibold mb-1">핵심 지표</p>
            <p className="text-xs text-[#555]">{stock.signals}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#fafafa] rounded-xl p-2 text-center">
              <p className="text-[10px] text-[#b0b0b8] mb-0.5">진입</p>
              <p className="text-xs font-semibold text-[#191919]">{stock.entry}</p>
            </div>
            <div className="bg-[#fff5f5] rounded-xl p-2 text-center">
              <p className="text-[10px] text-[#b0b0b8] mb-0.5">목표</p>
              <p className="text-xs font-semibold text-[#f04452]">{stock.target}</p>
            </div>
            <div className="bg-[#f5f8ff] rounded-xl p-2 text-center">
              <p className="text-[10px] text-[#b0b0b8] mb-0.5">손절</p>
              <p className="text-xs font-semibold text-[#2979ff]">{stock.stop}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCard({ cat }: { cat: PickCategory }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3.5 border-b border-[#f0f0f5]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-lg">{cat.emoji}</span>
          <h3 className="text-sm font-bold text-[#191919]">{cat.title}</h3>
        </div>
        <p className="text-xs text-[#7b7b7b]">{cat.description}</p>
      </div>
      <div className="flex-1">
        {cat.stocks.map((s, i) => (
          <StockCard key={s.ticker} stock={s} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

export default function PicksPage() {
  const { data, isLoading, error, mutate } = useSWR<PicksResponse>(
    "/api/ai/picks",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ai/picks?refresh=1");
      const fresh = await res.json();
      await mutate(fresh, false);
    } finally {
      setRefreshing(false);
    }
  }

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#191919]">AI 종목 추천</h1>
          {generatedAt && (
            <p className="text-xs text-[#b0b0b8] mt-0.5">{generatedAt} 기준 · 30분마다 갱신</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading || refreshing}
          className="h-9 px-4 rounded-xl bg-[#3182f6] text-white text-sm font-semibold hover:bg-[#1c6fe8] disabled:opacity-40 transition-colors"
        >
          {refreshing ? "생성 중..." : "새로 추천받기"}
        </button>
      </div>

      {(isLoading || refreshing) && !data?.categories && (
        <>
          <p className="text-sm text-[#7b7b7b] mb-4 text-center">
            거래량 상위 20종목 지표 분석 중 · AI 추천 생성 중...
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        </>
      )}

      {error && (
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <p className="text-sm text-[#f04452]">{error.message || "추천 생성 중 오류가 발생했습니다."}</p>
        </div>
      )}

      {data?.categories && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.categories.map((cat) => (
              <CategoryCard key={cat.id} cat={cat} />
            ))}
          </div>
          <p className="text-xs text-[#b0b0b8] text-center mt-6">
            본 추천은 기술적 지표 기반 AI 분석이며 투자 권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다.
          </p>
        </>
      )}
    </div>
  );
}
