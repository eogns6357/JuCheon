"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { POPULAR_STOCKS, signColor } from "@/lib/stocks";
import { STRATEGY_INFO } from "@/lib/strategy-glossary";

export interface Stock { ticker: string; name: string; }

interface Props {
  onSelect: (stock: Stock) => void;
  placeholder?: string;
  className?: string;
}

interface RankedStock extends Stock {
  rate?: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PICK_CARDS = (
  ["거래량돌파", "골든크로스", "MACD전환"] as const
).map((key) => {
  const info = STRATEGY_INFO[key];
  return {
    href: `/screener?strategy=${key}`,
    title: info.title,
    hint: info.hint,
    explain: info.explain,
  };
});

const AVATAR_COLORS = [
  "bg-[#3182f6]",
  "bg-[#f04452]",
  "bg-[#8b5cf6]",
  "bg-[#10b981]",
  "bg-[#f59e0b]",
];

function StockAvatar({ name, index }: { name: string; index: number }) {
  const ch = name.trim().charAt(0) || "?";
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
    >
      {ch}
    </span>
  );
}

function formatRate(rate: number | undefined) {
  if (rate === undefined || Number.isNaN(rate)) return null;
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)}%`;
}

function timeLabel() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  return `오늘 ${h}:${m} 기준`;
}

export function StockSearch({ onSelect, placeholder, className }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Stock[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [fetching, setFetching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isSearching = query.trim().length > 0;

  const { data: mood } = useSWR(
    open && !isSearching ? "/api/market/mood" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const popular: RankedStock[] = useMemo(() => {
    const fromApi = (mood?.volume30 ?? []) as { ticker: string; name: string; rate: number }[];
    if (fromApi.length > 0) {
      return fromApi.slice(0, 5).map((s) => ({
        ticker: s.ticker,
        name: s.name,
        rate: s.rate,
      }));
    }
    return POPULAR_STOCKS.slice(0, 5).map((s) => ({ ...s, rate: undefined }));
  }, [mood]);

  const activeItems: RankedStock[] = isSearching ? suggestions : popular;

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setHighlighted(-1);
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      const results: Stock[] = data.results ?? [];
      setSuggestions(results);
      setHighlighted(-1);
    } finally {
      setFetching(false);
    }
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 200);
  }

  function handleSelect(stock: Stock) {
    setQuery(stock.name);
    setSuggestions([]);
    setOpen(false);
    setHighlighted(-1);
    onSelect(stock);
  }

  function handleDirectSelect() {
    if (highlighted >= 0 && activeItems[highlighted]) {
      handleSelect(activeItems[highlighted]);
      return;
    }
    if (activeItems.length > 0) {
      handleSelect(activeItems[0]);
      return;
    }
    const q = query.trim();
    if (/^\d{6}$/.test(q)) {
      handleSelect({ ticker: q, name: q });
    }
  }

  function handleSearchButton() {
    if (!query.trim()) return;
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchSuggestions(query);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
        setSuggestions([]);
        setHighlighted(-1);
      } else {
        setOpen(false);
        setHighlighted(-1);
      }
      return;
    }

    if (!open) {
      if (e.key === "Enter") handleDirectSelect();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeItems.length === 0) return;
      setHighlighted((h) => {
        const next = h < 0 ? 0 : Math.min(h + 1, activeItems.length - 1);
        scrollToItem(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => {
        const next = Math.max(h - 1, -1);
        if (next >= 0) scrollToItem(next);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleDirectSelect();
    }
  }

  function scrollToItem(index: number) {
    const item = listRef.current?.querySelector(`[data-index="${index}"]`) as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }

  const showPanel = open && (isSearching ? suggestions.length > 0 || fetching : true);

  return (
    <div ref={containerRef} className={`relative ${className ?? "flex-1"}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#b0b0b8] pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder ?? "검색어를 입력해주세요"}
            className="bg-white border-[#ebebeb] rounded-xl h-11 pl-10 pr-8"
            autoComplete="off"
          />
          {fetching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-4 h-4 border-2 border-[#3182f6] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={handleSearchButton}
          disabled={!query.trim()}
          className="shrink-0 h-11 px-4 rounded-xl bg-[#3182f6] text-white text-sm font-semibold transition-all hover:bg-[#1c6fe8] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          검색
        </button>
      </div>

      {showPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#ebebeb] z-50 overflow-hidden">
          <div ref={listRef} className="max-h-[min(70vh,520px)] overflow-y-auto">
            {isSearching ? (
              <div className="py-1">
                {fetching && suggestions.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#b0b0b8] text-center">검색 중...</p>
                ) : suggestions.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#b0b0b8] text-center">검색 결과가 없습니다.</p>
                ) : (
                  suggestions.map((s, i) => (
                    <button
                      key={s.ticker}
                      data-index={i}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        highlighted === i ? "bg-[#f5f8ff]" : "hover:bg-[#fafafa]"
                      }`}
                    >
                      <StockAvatar name={s.name} index={i} />
                      <span className="text-sm font-medium text-[#191919]">{s.name}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#191919]">거래량·거래대금</span>
                  <span className="text-[11px] text-[#b0b0b8]">{timeLabel()}</span>
                </div>
                <div className="pb-2">
                  {popular.map((s, i) => {
                    const rateStr = formatRate(s.rate);
                    return (
                      <button
                        key={s.ticker}
                        data-index={i}
                        onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                        onMouseEnter={() => setHighlighted(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          highlighted === i ? "bg-[#f5f8ff]" : "hover:bg-[#fafafa]"
                        }`}
                      >
                        <span className="w-5 text-xs font-semibold text-[#b0b0b8] num shrink-0">{i + 1}</span>
                        <StockAvatar name={s.name} index={i} />
                        <span className="flex-1 text-sm font-medium text-[#191919] truncate">{s.name}</span>
                        {rateStr && (
                          <span className={`text-sm font-semibold num shrink-0 ${signColor(s.rate ?? 0)}`}>
                            {rateStr}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="px-4 pt-3 pb-2 flex items-center justify-between border-t border-[#f0f0f5]">
                  <span className="text-sm font-bold text-[#191919]">전략별 종목 보기</span>
                  <Link
                    href="/screener"
                    onMouseDown={(e) => e.stopPropagation()}
                    className="text-xs text-[#7b7b7b] hover:text-[#3182f6] transition-colors"
                  >
                    더 보기 &gt;
                  </Link>
                </div>
                <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
                  {PICK_CARDS.map((card) => (
                    <Link
                      key={card.href}
                      href={card.href}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="shrink-0 w-[168px] rounded-xl bg-[#f5f5f8] hover:bg-[#ebebf0] px-3.5 py-3 transition-colors"
                    >
                      <p className="text-sm font-semibold text-[#191919] mb-0.5">{card.title}</p>
                      <p className="text-[11px] text-[#3182f6] font-medium mb-1">{card.hint}</p>
                      <p className="text-[10px] text-[#7b7b7b] leading-snug line-clamp-3">{card.explain}</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-[#f0f0f5] bg-[#fafafa] text-[11px] text-[#b0b0b8]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#ebebeb] text-[10px] font-medium text-[#7b7b7b]">Enter</kbd>
              종목 선택
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#ebebeb] text-[10px] font-medium text-[#7b7b7b]">ESC</kbd>
              닫기
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#ebebeb] text-[10px] font-medium text-[#7b7b7b]">↑↓</kbd>
              탐색
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
