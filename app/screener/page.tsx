"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fmt, signColor } from "@/lib/stocks";
import { STRATEGY_INFO, STRATEGY_TAB_ALL_HINT, INDICATOR_HINTS } from "@/lib/strategy-glossary";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STRATEGY_COLORS: Record<string, string> = {
  "거래량돌파": "bg-[#f04452]/10 text-[#f04452]",
  "골든크로스": "bg-[#3182f6]/10 text-[#3182f6]",
  "MACD전환":  "bg-purple-100 text-purple-600",
  "눌림목반등": "bg-orange-100 text-orange-600",
};

const COUNT_OPTIONS = [50, 100, 200, 300, 500];
const STRATEGY_TABS = ["전체", "거래량돌파", "골든크로스", "MACD전환", "눌림목반등"];

interface Stock {
  ticker: string; name: string;
  open: number; high: number; low: number; close: number;
  changeRate: number; ret5d: number;
  volume: number; volRatio: number;
  rsi: number | null;
  macd: number | null; macdSignal: number | null; macdHist: number | null;
  ma5: number | null; ma20: number | null; ma60: number | null;
  bbUpper: number | null; bbMiddle: number | null; bbLower: number | null;
  atr: number | null;
  high20: number; pullbackPct: number;
  strategies: string[];
  score: number;
  foreignNet5d: number;
  instNet5d: number;
}

function MaStatus({ label, price, ma }: { label: string; price: number; ma: number | null }) {
  if (!ma) return null;
  const above = price > ma;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#7b7b7b]">{label}</span>
      <span className={`font-semibold num ${above ? "positive" : "negative"}`}>
        {fmt(ma)} ({above ? "▲" : "▼"} {Math.abs(((price - ma) / ma) * 100).toFixed(1)}%)
      </span>
    </div>
  );
}

function DetailRow({ stock }: { stock: Stock }) {
  return (
    <tr>
      <td colSpan={8} className="px-5 py-0">
        <div className="bg-[#f8f9fc] rounded-2xl p-5 my-2 grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* 가격 정보 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#7b7b7b] mb-3">가격 정보</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">시가</span>
                <span className="num font-medium">{fmt(stock.open)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">고가</span>
                <span className="num font-medium positive">{fmt(stock.high)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">저가</span>
                <span className="num font-medium negative">{fmt(stock.low)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">20일 고점</span>
                <span className="num font-medium">{fmt(stock.high20)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">고점 대비</span>
                <span className={`num font-medium ${signColor(stock.pullbackPct)}`}>
                  {stock.pullbackPct.toFixed(1)}%
                </span>
              </div>
              {stock.atr && (
                <div className="flex justify-between">
                  <span className="text-[#7b7b7b]">ATR(14)</span>
                  <span className="num">{fmt(stock.atr)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 이동평균 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#7b7b7b] mb-1">이동평균</p>
            <p className="text-[10px] text-[#b0b0b8] mb-3 leading-relaxed">
              {INDICATOR_HINTS.MA5} · {INDICATOR_HINTS.MA20}
            </p>
            <div className="space-y-2">
              <MaStatus label="MA5"  price={stock.close} ma={stock.ma5} />
              <MaStatus label="MA20" price={stock.close} ma={stock.ma20} />
              <MaStatus label="MA60" price={stock.close} ma={stock.ma60} />
            </div>
            {stock.ma5 && stock.ma20 && (
              <div className={`mt-3 text-xs px-2.5 py-1.5 rounded-lg font-medium ${
                stock.ma5 > stock.ma20 ? "bg-[#f04452]/10 text-[#f04452]" : "bg-[#2979ff]/10 text-[#2979ff]"
              }`}>
                {stock.ma5 > stock.ma20 ? "정배열 (MA5 > MA20)" : "역배열 (MA5 < MA20)"}
              </div>
            )}
          </div>

          {/* MACD & RSI */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#7b7b7b] mb-1">MACD / RSI</p>
            <p className="text-[10px] text-[#b0b0b8] mb-3 leading-relaxed">
              {INDICATOR_HINTS.MACD} · {INDICATOR_HINTS.RSI}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">MACD</span>
                <span className={`num font-medium ${(stock.macd ?? 0) > 0 ? "positive" : "negative"}`}>
                  {stock.macd?.toFixed(2) ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">시그널</span>
                <span className="num">{stock.macdSignal?.toFixed(2) ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7b7b7b]">히스토그램</span>
                <span className={`num font-semibold ${(stock.macdHist ?? 0) > 0 ? "positive" : "negative"}`}>
                  {stock.macdHist?.toFixed(2) ?? "-"}
                </span>
              </div>
              <div className="border-t border-[#f0f0f5] pt-1.5 mt-1.5">
                <div className="flex justify-between mb-1">
                  <span className="text-[#7b7b7b]">RSI(14)</span>
                  <span className={`num font-semibold ${
                    (stock.rsi ?? 50) >= 70 ? "positive" :
                    (stock.rsi ?? 50) <= 30 ? "negative" : "text-[#191919]"
                  }`}>
                    {stock.rsi?.toFixed(1) ?? "-"}
                  </span>
                </div>
                {stock.rsi && (
                  <div className="w-full h-1.5 bg-[#f0f0f5] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        stock.rsi >= 70 ? "bg-[#f04452]" :
                        stock.rsi <= 30 ? "bg-[#2979ff]" : "bg-[#3182f6]"
                      }`}
                      style={{ width: `${stock.rsi}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 볼린저밴드 & 전략 & 수급 */}
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-[#7b7b7b] mb-3">볼린저밴드(20)</p>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "상단", val: stock.bbUpper },
                  { label: "중간", val: stock.bbMiddle },
                  { label: "하단", val: stock.bbLower },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[#7b7b7b]">{label}</span>
                    <span className={`num font-medium ${
                      val && stock.close > val ? "positive" :
                      val && stock.close < val ? "negative" : "text-[#555]"
                    }`}>
                      {val ? fmt(val) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 전략 근거 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-[#7b7b7b] mb-2">매칭 전략</p>
              <div className="space-y-2">
                {stock.strategies.map((st) => {
                  const info = STRATEGY_INFO[st];
                  return (
                    <div key={st}>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STRATEGY_COLORS[st] ?? "bg-gray-100 text-[#555]"}`}>
                        {info?.title ?? st}
                      </span>
                      {info && (
                        <>
                          <p className="text-[10px] text-[#3182f6] font-medium mt-1.5">{info.hint}</p>
                          <p className="text-[10px] text-[#7b7b7b] mt-0.5 leading-relaxed">{info.explain}</p>
                          <p className="text-[10px] text-[#b0b0b8] mt-1">조건: {info.criteria}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 수급 (5일) */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-[#7b7b7b] mb-3">수급 현황 (5일)</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#7b7b7b]">외국인 순매수</span>
                  <span className={`num font-semibold ${
                    stock.foreignNet5d > 0 ? "positive" : stock.foreignNet5d < 0 ? "negative" : "text-[#555]"
                  }`}>
                    {stock.foreignNet5d > 0 ? "+" : ""}{stock.foreignNet5d.toLocaleString()}주
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7b7b7b]">기관 순매수</span>
                  <span className={`num font-semibold ${
                    stock.instNet5d > 0 ? "positive" : stock.instNet5d < 0 ? "negative" : "text-[#555]"
                  }`}>
                    {stock.instNet5d > 0 ? "+" : ""}{stock.instNet5d.toLocaleString()}주
                  </span>
                </div>
              </div>
              {stock.foreignNet5d > 0 && stock.instNet5d > 0 && (
                <div className="mt-2 text-[10px] px-2 py-1 rounded-lg font-semibold bg-[#f04452]/10 text-[#f04452]">
                  외국인·기관 동반 매수 ↑
                </div>
              )}
              {stock.foreignNet5d < 0 && stock.instNet5d < 0 && (
                <div className="mt-2 text-[10px] px-2 py-1 rounded-lg font-semibold bg-[#2979ff]/10 text-[#2979ff]">
                  외국인·기관 동반 매도 ↓
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 바로가기 */}
        <div className="flex gap-2 pb-3">
          <a
            href={`/quote?ticker=${stock.ticker}`}
            className="text-xs px-3 py-1.5 bg-[#3182f6]/10 text-[#3182f6] rounded-lg font-medium hover:bg-[#3182f6]/20 transition-colors"
          >
            📡 실시간 시세
          </a>
          <a
            href={`/quote?ticker=${stock.ticker}&name=${encodeURIComponent(stock.name)}`}
            className="text-xs px-3 py-1.5 bg-gray-100 text-[#555] rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            📊 시세·분석
          </a>
        </div>
      </td>
    </tr>
  );
}

export default function ScreenerPage() {
  const [count, setCount] = useState(100);
  const [activeStrategy, setActiveStrategy] = useState("전체");
  const [submitted, setSubmitted] = useState(100);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("strategy");
    if (s && STRATEGY_TABS.includes(s)) setActiveStrategy(s);
  }, []);

  const { data, isLoading, mutate } = useSWR(
    `/api/screener?count=${submitted}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const allStocks: Stock[] = data?.stocks ?? [];
  const filtered =
    activeStrategy === "전체"
      ? allStocks
      : allStocks.filter((s) => s.strategies.includes(activeStrategy));

  function toggleExpand(ticker: string) {
    setExpanded((prev) => (prev === ticker ? null : ticker));
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">종목 스크리너</h1>

      {/* 조회 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs text-[#7b7b7b] mb-2">조회 종목 수</p>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    count === n ? "bg-[#3182f6] text-white" : "bg-[#f5f5f8] text-[#555] hover:bg-gray-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setSubmitted(count); mutate(); setExpanded(null); }}
            disabled={isLoading}
            className="bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl px-5 h-9 text-sm font-semibold disabled:opacity-50"
          >
            {isLoading ? "스캔 중..." : "스캔 시작"}
          </button>
          {data?.scanned && (
            <p className="text-xs text-[#b0b0b8]">
              {data.scanned}개 스캔 → {allStocks.length}개 발굴
            </p>
          )}
        </div>
      </div>

      {/* 전략 탭 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STRATEGY_TABS.map((tab) => {
          const cnt = tab === "전체"
            ? allStocks.length
            : allStocks.filter((s) => s.strategies.includes(tab)).length;
          return (
            <button
              key={tab}
              onClick={() => { setActiveStrategy(tab); setExpanded(null); }}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                activeStrategy === tab
                  ? "bg-[#191919] text-white"
                  : "bg-white text-[#555] hover:bg-gray-100 shadow-sm"
              }`}
            >
              {tab}
              {!isLoading && <span className="ml-1.5 text-xs opacity-70">{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* 선택한 전략 설명 */}
      <div className="mb-4 bg-white rounded-2xl px-4 py-3 shadow-sm border border-[#f0f0f5]">
        {activeStrategy === "전체" ? (
          <>
            <p className="text-sm font-semibold text-[#191919]">{STRATEGY_TAB_ALL_HINT.title}</p>
            <p className="text-xs text-[#7b7b7b] mt-1 leading-relaxed">{STRATEGY_TAB_ALL_HINT.explain}</p>
          </>
        ) : (
          (() => {
            const info = STRATEGY_INFO[activeStrategy];
            if (!info) return null;
            return (
              <>
                <p className="text-sm font-semibold text-[#191919]">{info.title}</p>
                <p className="text-xs text-[#3182f6] font-medium mt-1">{info.hint}</p>
                <p className="text-xs text-[#7b7b7b] mt-1 leading-relaxed">{info.explain}</p>
                <p className="text-[10px] text-[#b0b0b8] mt-2">스캔 조건: {info.criteria}</p>
              </>
            );
          })()
        )}
      </div>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#3182f6] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-[#7b7b7b]">{submitted}개 종목 스캔 중...</p>
            <p className="text-xs text-[#b0b0b8] mt-1">종목 수에 따라 30초~2분 소요</p>
          </div>
        ) : data?.error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#f04452] mb-1">오류 발생</p>
            <p className="text-xs text-[#b0b0b8]">{data.error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#b0b0b8]">
            {allStocks.length === 0 ? "스캔 시작 버튼을 눌러주세요." : "해당 전략 종목이 없습니다."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#f0f0f5]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7b7b7b]">종목</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">현재가</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">등락률</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">5일수익률</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">거래량비율</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">RSI</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">점수</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7b7b7b]">전략</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <>
                    <tr
                      key={s.ticker}
                      className={`border-b border-[#f0f0f5] transition-colors cursor-pointer ${
                        expanded === s.ticker ? "bg-[#f5f8ff]" : "hover:bg-[#fafafa]"
                      }`}
                      onClick={() => toggleExpand(s.ticker)}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-[#b0b0b8] mr-2">{i + 1}</span>
                        <span className="font-semibold text-[#191919] hover:text-[#3182f6] transition-colors">
                          {s.name}
                        </span>
                        <span className="ml-2 text-xs text-[#b0b0b8]">
                          {expanded === s.ticker ? "▲" : "▼"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right num font-medium">{fmt(s.close)}</td>
                      <td className={`px-4 py-3.5 text-right num font-medium ${signColor(s.changeRate)}`}>
                        {s.changeRate > 0 ? "+" : ""}{s.changeRate.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-3.5 text-right num ${signColor(s.ret5d)}`}>
                        {s.ret5d > 0 ? "+" : ""}{s.ret5d.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-3.5 text-right num font-medium ${s.volRatio >= 2 ? "text-[#f04452]" : "text-[#555]"}`}>
                        {s.volRatio.toFixed(1)}x
                      </td>
                      <td className={`px-4 py-3.5 text-right num ${
                        s.rsi !== null && s.rsi >= 70 ? "text-[#f04452]" :
                        s.rsi !== null && s.rsi <= 30 ? "text-[#2979ff]" : "text-[#555]"
                      }`}>
                        {s.rsi !== null ? s.rsi.toFixed(1) : "-"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 bg-[#f0f0f5] rounded-full overflow-hidden">
                            <div className="h-full bg-[#3182f6] rounded-full" style={{ width: `${s.score}%` }} />
                          </div>
                          <span className="num font-bold text-[#191919] w-6 text-right">{s.score}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1 flex-wrap">
                          {s.strategies.map((st) => (
                            <span
                              key={st}
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STRATEGY_COLORS[st] ?? "bg-gray-100 text-[#555]"}`}
                            >
                              {st}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {expanded === s.ticker && <DetailRow key={`detail-${s.ticker}`} stock={s} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
