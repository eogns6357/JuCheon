"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { StockSearch } from "@/components/ui/stock-search";
import { TermHelp } from "@/components/ui/term-help";
import { StockAnalysisSection } from "@/components/quote/stock-analysis-section";
import { StockNewsSection } from "@/components/quote/stock-news-section";
import { fmt, signColor } from "@/lib/stocks";
import { QUOTE_METRIC_HELP } from "@/lib/strategy-glossary";

interface VolumeStock {
  ticker: string;
  name: string;
  price: number;
  rate: number;
}

function VolumeMiniCard({
  stock,
  rank,
  selected,
  onClick,
}: {
  stock: VolumeStock;
  rank: number;
  selected: boolean;
  onClick: () => void;
}) {
  const sign = stock.rate > 0 ? "+" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-0.5 rounded-xl px-2 py-2 text-left transition-all min-h-[52px] ${
        selected
          ? "bg-[#3182f6] text-white shadow-sm ring-2 ring-[#3182f6]/30"
          : "bg-white shadow-sm hover:shadow-md hover:bg-[#fafafa]"
      }`}
    >
      <span className={`text-[10px] font-medium num ${selected ? "text-white/70" : "text-[#b0b0b8]"}`}>
        {rank}
      </span>
      <span className={`text-[11px] font-semibold leading-tight line-clamp-2 ${selected ? "text-white" : "text-[#191919]"}`}>
        {stock.name}
      </span>
      <span
        className={`text-[10px] font-bold num ${
          selected ? "text-white" : signColor(stock.rate)
        }`}
      >
        {sign}{stock.rate.toFixed(2)}%
      </span>
    </button>
  );
}

function VolumeGridSection({
  mood,
  moodLoading,
  volumeStocks,
  ticker,
  onSelect,
  compact,
}: {
  mood: { stale?: boolean; savedAt?: string; error?: string } | undefined;
  moodLoading: boolean;
  volumeStocks: VolumeStock[];
  ticker: string;
  onSelect: (s: VolumeStock) => void;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "mt-8 pt-6 border-t border-[#ebebeb]" : "mb-6"}>
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold text-[#191919]">거래량·거래대금 상위</h2>
        <span className="text-[10px] text-[#b0b0b8] text-right">
          {mood?.stale && mood.savedAt
            ? `마감 기준 · ${new Date(mood.savedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : compact
              ? "다른 종목 선택"
              : "클릭하면 시세 조회"}
        </span>
      </div>
      {moodLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-[52px] rounded-xl bg-white animate-pulse" />
          ))}
        </div>
      ) : mood?.error && volumeStocks.length === 0 ? (
        <p className="text-xs text-[#b0b0b8] py-4 text-center">
          거래량 순위를 불러올 수 없습니다. 장중에 한 번 조회되면 마감 후에도 표시됩니다.
        </p>
      ) : volumeStocks.length === 0 ? (
        <p className="text-xs text-[#b0b0b8] py-4 text-center">데이터가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {volumeStocks.slice(0, 30).map((s, i) => (
            <VolumeMiniCard
              key={s.ticker}
              stock={s}
              rank={i + 1}
              selected={ticker === s.ticker}
              onClick={() => onSelect(s)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const CandlestickChart = dynamic(
  () => import("@/components/ui/candlestick-chart").then((m) => m.CandlestickChart),
  { ssr: false, loading: () => <div className="w-full h-[380px] bg-gray-50 rounded-xl animate-pulse" /> }
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MINUTE_PERIODS = ["1", "3", "5", "10", "15", "30", "60", "120", "240"];
const OHLCV_PERIODS = [
  { code: "D", label: "일" },
  { code: "W", label: "주" },
  { code: "M", label: "월" },
  { code: "Y", label: "년" },
];

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const help = QUOTE_METRIC_HELP[label];
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="inline-flex items-center text-xs text-[#7b7b7b] mb-1">
        {label}
        {help && <TermHelp title={help.title} body={help.body} />}
      </p>
      <p className="text-lg font-bold text-[#191919] num">{value}</p>
      {sub && <p className="text-xs text-[#b0b0b8] num mt-0.5">{sub}</p>}
    </div>
  );
}

export default function QuotePage() {
  const params = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search) : null;

  const [ticker, setTicker] = useState(params?.get("ticker") ?? "");
  const [name, setName] = useState(params?.get("name") ?? "");
  const [period, setPeriod] = useState("D");

  const showDetail = Boolean(ticker);
  const isMinute = MINUTE_PERIODS.includes(period);

  const { data: price, isLoading: priceLoading } = useSWR(
    showDetail ? `/api/kis/price?ticker=${ticker}` : null,
    fetcher,
    { refreshInterval: 15000 }
  );
  const { data: chart, isLoading: chartLoading } = useSWR(
    showDetail ? `/api/kis/chart?ticker=${ticker}&period=${period}` : null,
    fetcher
  );
  const { data: mood, isLoading: moodLoading } = useSWR("/api/market/mood", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  const volumeStocks: VolumeStock[] = mood?.volume30 ?? [];
  const rate = price?.rate ?? 0;
  const sign = rate > 0 ? "+" : "";

  function selectStock(s: { ticker: string; name: string }) {
    setTicker(s.ticker);
    setName(s.name);
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">종목 시세 · 분석 · 뉴스</h1>

      <div className="mb-4">
        <StockSearch
          onSelect={selectStock}
          placeholder="검색어를 입력해주세요"
        />
      </div>

      {showDetail && (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            {priceLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-5 bg-gray-100 rounded w-32" />
                <div className="h-9 bg-gray-100 rounded w-48" />
              </div>
            ) : price?.price ? (
              <>
                <h2 className="text-lg font-bold text-[#191919] mb-1">{name || ticker}</h2>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-[#191919] num">{fmt(price.price)}</span>
                  <span className={`text-lg font-semibold num ${signColor(rate)}`}>
                    {sign}{fmt(price.change)} ({sign}{rate.toFixed(2)}%)
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[#7b7b7b] text-sm">시세 데이터 없음</p>
            )}
          </div>

          <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
            {MINUTE_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-[#191919] text-white"
                    : "bg-white text-[#555] shadow-sm hover:bg-gray-100"
                }`}
              >
                {p}분
              </button>
            ))}
            <div className="shrink-0 w-px h-4 bg-[#ebebeb] mx-1" />
            {OHLCV_PERIODS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setPeriod(code)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === code
                    ? "bg-[#191919] text-white"
                    : "bg-white text-[#555] shadow-sm hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            {chartLoading ? (
              <div className="w-full h-[380px] flex items-center justify-center">
                <div className="inline-block w-6 h-6 border-2 border-[#3182f6] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chart?.candles?.length > 0 ? (
              <CandlestickChart
                data={chart.candles}
                height={380}
                showTime={isMinute}
              />
            ) : (
              <div className="w-full h-[380px] flex flex-col items-center justify-center text-[#b0b0b8] gap-2">
                <p className="text-sm">
                  {isMinute ? "분봉 데이터 없음 (장 중에만 제공)" : "차트 데이터 없음"}
                </p>
                {isMinute && (
                  <p className="text-xs">일봉 차트로 조회하려면 &apos;일&apos; 버튼을 누르세요.</p>
                )}
              </div>
            )}
          </div>

          {price?.price && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
              <MetricCard label="거래량" value={fmt(price.volume)} />
              <MetricCard label="고가" value={fmt(price.high)} />
              <MetricCard label="저가" value={fmt(price.low)} />
              <MetricCard label="시가" value={fmt(price.open)} />
              <MetricCard label="PER" value={price.per > 0 ? price.per.toFixed(2) + "배" : "N/A"} />
              <MetricCard label="PBR" value={price.pbr > 0 ? price.pbr.toFixed(2) + "배" : "N/A"} />
              <MetricCard label="52주 최고" value={fmt(price.w52High)} />
              <MetricCard label="52주 최저" value={fmt(price.w52Low)} />
            </div>
          )}

          <StockAnalysisSection ticker={ticker} name={name || ticker} />
          <StockNewsSection ticker={ticker} name={name || ticker} />
        </>
      )}

      <VolumeGridSection
        mood={mood}
        moodLoading={moodLoading}
        volumeStocks={volumeStocks}
        ticker={ticker}
        onSelect={selectStock}
        compact={showDetail}
      />
    </div>
  );
}
