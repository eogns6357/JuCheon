"use client";

import useSWR from "swr";
import { fmt, signColor } from "@/lib/stocks";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function IndexCard({ name, value, change, rate }: { name: string; value: number; change: number; rate: number }) {
  const cls = signColor(rate);
  const sign = rate > 0 ? "+" : "";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex-1">
      <p className="text-xs text-[#7b7b7b] mb-1">{name}</p>
      <p className="text-3xl font-bold text-[#191919] num">{fmt(value, 2)}</p>
      <p className={`text-base font-semibold num mt-1 ${cls}`}>
        {sign}{fmt(change, 2)} ({sign}{rate.toFixed(2)}%)
      </p>
    </div>
  );
}

export default function MarketPage() {
  const { data: idx, isLoading } = useSWR("/api/kis/indices", fetcher, { refreshInterval: 30000 });
  const { data: scr } = useSWR("/api/screener", fetcher, { revalidateOnFocus: false });

  const stocks = scr?.stocks ?? [];
  const rising = stocks.filter((s: { changeRate: number }) => s.changeRate > 0).length;
  const falling = stocks.filter((s: { changeRate: number }) => s.changeRate < 0).length;
  const flat = stocks.length - rising - falling;

  const avgScore = stocks.length > 0
    ? Math.round(stocks.reduce((s: number, r: { score: number }) => s + r.score, 0) / stocks.length)
    : 0;

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">시장 흐름</h1>

      {/* 지수 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">주요 지수</h2>
        <div className="flex gap-3 flex-wrap">
          {isLoading ? (
            <>
              <div className="flex-1 bg-white rounded-2xl h-28 animate-pulse shadow-sm" />
              <div className="flex-1 bg-white rounded-2xl h-28 animate-pulse shadow-sm" />
            </>
          ) : (
            <>
              {idx?.kospi && <IndexCard name="KOSPI" {...idx.kospi} />}
              {idx?.kosdaq && <IndexCard name="KOSDAQ" {...idx.kosdaq} />}
            </>
          )}
        </div>
      </section>

      {/* 시장 분위기 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">시장 분위기 (주요 30종목)</h2>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          {stocks.length === 0 ? (
            <p className="text-sm text-[#b0b0b8] text-center py-4">스크리너 데이터 로딩 중...</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-3 rounded-full overflow-hidden flex">
                  <div className="bg-[#f04452]" style={{ width: `${(rising / stocks.length) * 100}%` }} />
                  <div className="bg-[#ebebeb]" style={{ width: `${(flat / stocks.length) * 100}%` }} />
                  <div className="bg-[#2979ff]" style={{ width: `${(falling / stocks.length) * 100}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#f04452] font-semibold">상승 {rising}개</span>
                <span className="text-[#7b7b7b]">보합 {flat}개</span>
                <span className="text-[#2979ff] font-semibold">하락 {falling}개</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#f0f0f5] flex items-center justify-between">
                <span className="text-sm text-[#7b7b7b]">평균 시그널 점수</span>
                <span className="text-lg font-bold num text-[#191919]">{avgScore} / 100</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 등락률 순위 */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">상승률 상위</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[...stocks]
                .sort((a: { changeRate: number }, b: { changeRate: number }) => b.changeRate - a.changeRate)
                .slice(0, 5)
                .map((s: { ticker: string; name: string; close: number; changeRate: number }) => (
                  <div key={s.ticker} className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f5] last:border-0">
                    <div>
                      <span className="text-sm font-semibold text-[#191919]">{s.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm num font-medium">{fmt(s.close)}</p>
                      <p className={`text-xs num font-semibold ${signColor(s.changeRate)}`}>
                        +{s.changeRate.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#7b7b7b] mb-3">하락률 상위</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[...stocks]
                .sort((a: { changeRate: number }, b: { changeRate: number }) => a.changeRate - b.changeRate)
                .slice(0, 5)
                .map((s: { ticker: string; name: string; close: number; changeRate: number }) => (
                  <div key={s.ticker} className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f5] last:border-0">
                    <div>
                      <span className="text-sm font-semibold text-[#191919]">{s.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm num font-medium">{fmt(s.close)}</p>
                      <p className={`text-xs num font-semibold ${signColor(s.changeRate)}`}>
                        {s.changeRate.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
