"use client";

import useSWR from "swr";
import { fmt, signColor } from "@/lib/stocks";
import type { MarketStock } from "@/app/api/market/mood/route";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function IndexCard({ name, value, change, rate }: { name: string; value: number; change: number; rate: number }) {
  const cls = signColor(rate);
  const sign = rate > 0 ? "+" : "";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex-1 min-w-[140px]">
      <p className="text-xs text-[#7b7b7b] font-medium mb-1">{name}</p>
      <p className="text-2xl font-bold text-[#191919] num">{fmt(value, 2)}</p>
      <p className={`text-sm font-medium num mt-1 ${cls}`}>
        {sign}{fmt(change, 2)} ({sign}{rate.toFixed(2)}%)
      </p>
    </div>
  );
}

function VolumePill({ s }: { s: MarketStock }) {
  const pos = s.rate > 0;
  const neg = s.rate < 0;
  const cls = pos
    ? "bg-[#fff1f2] text-[#f04452] hover:bg-[#ffe4e6]"
    : neg
    ? "bg-[#eff6ff] text-[#2979ff] hover:bg-[#dbeafe]"
    : "bg-[#f5f5f8] text-[#7b7b7b] hover:bg-[#ebebeb]";
  return (
    <a
      href={`/quote?ticker=${s.ticker}&name=${encodeURIComponent(s.name)}`}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${cls}`}
    >
      {s.name} {pos ? "+" : ""}{s.rate.toFixed(2)}%
    </a>
  );
}

function MoverRow({ s, i, isGainer }: { s: MarketStock; i: number; isGainer: boolean }) {
  return (
    <a
      href={`/quote?ticker=${s.ticker}&name=${encodeURIComponent(s.name)}`}
      className="flex items-center justify-between py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] -mx-4 px-4 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] text-[#b0b0b8] w-4 shrink-0">{i + 1}</span>
        <span className="text-xs text-[#191919] font-medium truncate">{s.name}</span>
      </div>
      <span className={`text-xs font-bold num shrink-0 ml-2 ${isGainer ? "text-[#f04452]" : "text-[#2979ff]"}`}>
        {isGainer ? "+" : ""}{s.rate.toFixed(2)}%
      </span>
    </a>
  );
}

function SkeletonPills() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="h-6 rounded-lg bg-[#f0f0f5] animate-pulse" style={{ width: `${50 + (i % 5) * 15}px` }} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { data: idx } = useSWR("/api/kis/indices", fetcher, { refreshInterval: 30000 });
  const { data: mood, isLoading: moodLoading } = useSWR("/api/market/mood", fetcher, { refreshInterval: 60000 });
  const { data: scr } = useSWR("/api/screener", fetcher, { revalidateOnFocus: false });

  const top5 = scr?.stocks?.slice(0, 5) ?? [];
  const volume30: MarketStock[] = mood?.volume30 ?? [];
  const gainers: MarketStock[] = mood?.gainers ?? [];
  const losers: MarketStock[] = mood?.losers ?? [];

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">대시보드</h1>

      {/* 시장 지수 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">시장 지수</h2>
        <div className="flex gap-3 flex-wrap">
          {idx?.kospi ? (
            <IndexCard name="KOSPI" {...idx.kospi} />
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm flex-1 min-w-[140px] animate-pulse h-24" />
          )}
          {idx?.kosdaq ? (
            <IndexCard name="KOSDAQ" {...idx.kosdaq} />
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm flex-1 min-w-[140px] animate-pulse h-24" />
          )}
        </div>
      </section>

      {/* 오늘 시장 흐름 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">오늘 시장 흐름</h2>

        {/* 거래량 상위 30 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <p className="text-xs font-semibold text-[#191919] mb-1">
            거래량·거래대금 상위 30
            <span className="text-[10px] text-[#b0b0b8] font-normal ml-2">· 1분 갱신 · 클릭하면 시세로 이동</span>
          </p>
          <p className="text-[10px] text-[#b0b0b8] mb-3">거래량과 거래대금을 함께 반영한 핵심 종목</p>
          {moodLoading ? (
            <SkeletonPills />
          ) : mood?.error ? (
            <p className="text-xs text-[#b0b0b8]">장 마감 중이거나 데이터를 불러올 수 없습니다.</p>
          ) : volume30.length === 0 ? (
            <p className="text-xs text-[#b0b0b8]">데이터 없음</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {volume30.map((s) => (
                <VolumePill key={s.ticker} s={s} />
              ))}
            </div>
          )}
        </div>

        {/* 상승 / 하락 상위 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#f04452] mb-3">상승률 상위</p>
            {moodLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[#f0f0f5] rounded animate-pulse" />
                ))}
              </div>
            ) : gainers.length === 0 ? (
              <p className="text-xs text-[#b0b0b8]">데이터 없음</p>
            ) : (
              gainers.map((s, i) => <MoverRow key={s.ticker} s={s} i={i} isGainer />)
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#2979ff] mb-3">하락률 상위</p>
            {moodLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[#f0f0f5] rounded animate-pulse" />
                ))}
              </div>
            ) : losers.length === 0 ? (
              <p className="text-xs text-[#b0b0b8]">데이터 없음</p>
            ) : (
              losers.map((s, i) => <MoverRow key={s.ticker} s={s} i={i} isGainer={false} />)
            )}
          </div>
        </div>
      </section>

      {/* 상위 종목 시그널 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">상위 종목 시그널</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {top5.length === 0 ? (
            <div className="p-8 text-center text-[#b0b0b8] text-sm">
              {scr?.error ? "데이터를 불러오는 중 오류가 발생했습니다." : "로딩 중..."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0f0f5]">
                    <th className="px-5 py-3 text-left text-[#7b7b7b] font-medium text-xs">종목</th>
                    <th className="px-4 py-3 text-right text-[#7b7b7b] font-medium text-xs">현재가</th>
                    <th className="px-4 py-3 text-right text-[#7b7b7b] font-medium text-xs">등락률</th>
                    <th className="px-4 py-3 text-right text-[#7b7b7b] font-medium text-xs">RSI</th>
                    <th className="px-4 py-3 text-right text-[#7b7b7b] font-medium text-xs">점수</th>
                    <th className="px-5 py-3 text-left text-[#7b7b7b] font-medium text-xs">전략</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((s: Record<string, string | number>, i: number) => (
                    <tr key={i} className="border-b border-[#f0f0f5] last:border-0 hover:bg-[#fafafa]">
                      <td className="px-5 py-3.5 font-semibold text-[#191919]">
                        <a
                          href={`/quote?ticker=${s.ticker}&name=${encodeURIComponent(String(s.name))}`}
                          className="hover:text-[#3182f6] transition-colors"
                        >
                          {String(s.name)}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-right num">{fmt(Number(s.close))}</td>
                      <td className={`px-4 py-3.5 text-right num font-medium ${signColor(Number(s.changeRate))}`}>
                        {Number(s.changeRate) > 0 ? "+" : ""}{Number(s.changeRate).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3.5 text-right num text-[#555]">
                        {s.rsi !== null ? Number(s.rsi).toFixed(1) : "-"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-[#f0f0f5] rounded-full overflow-hidden">
                            <div className="h-full bg-[#3182f6] rounded-full" style={{ width: `${s.score}%` }} />
                          </div>
                          <span className="num text-[#191919] font-medium w-6 text-right">{String(s.score)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1 flex-wrap">
                          {(s.strategies as unknown as string[] ?? []).map((st: string) => (
                            <span key={st} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f04452]/10 text-[#f04452]">
                              {st}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 바로가기 */}
      <section>
        <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">바로가기</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/quote",    icon: "📡", label: "실시간 시세" },
            { href: "/screener", icon: "🔍", label: "종목 스크리너" },
            { href: "/quote", icon: "📊", label: "종목 시세·분석" },
            { href: "/risk",     icon: "💰", label: "리스크 계산기" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-medium text-[#191919]">{item.label}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
