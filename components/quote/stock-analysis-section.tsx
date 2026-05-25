"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TermHelp } from "@/components/ui/term-help";
import { fmt, signColor } from "@/lib/stocks";
import { SIGNAL_HELP } from "@/lib/strategy-glossary";

interface SeriesPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Summary {
  date: string;
  close: number;
  ret1d: number;
  ret5d: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bbPos: number;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  atr: number | null;
  volRatio: number;
  score: number;
  trend: string;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#f04452" : score >= 50 ? "#3182f6" : "#7b7b7b";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#f0f0f5] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-lg font-bold num" style={{ color }}>{score}</span>
      <span className="text-sm text-[#7b7b7b]">/ 100</span>
    </div>
  );
}

function LabelWithHelp({ label, helpKey }: { label: string; helpKey?: string }) {
  const help = helpKey ? SIGNAL_HELP[helpKey] : undefined;
  return (
    <span className="inline-flex items-center text-xs text-[#7b7b7b]">
      {label}
      {help && <TermHelp title={help.title} body={help.body} />}
    </span>
  );
}

function MetricCard({
  label,
  helpKey,
  value,
  sub,
  valueClass,
}: {
  label: string;
  helpKey?: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[#fafafa] rounded-xl p-3">
      <p className="mb-1">
        <LabelWithHelp label={label} helpKey={helpKey ?? label} />
      </p>
      <p className={`font-semibold text-[#191919] num ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-[#b0b0b8] num mt-0.5">{sub}</p>}
    </div>
  );
}

function signalRow(label: string, value: string, color: string) {
  const help = SIGNAL_HELP[label];
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[#f5f5f5] last:border-0">
      <span className="inline-flex items-center text-sm text-[#555] shrink-0">
        {label}
        {help && <TermHelp title={help.title} body={help.body} />}
      </span>
      <span className={`text-sm font-semibold text-right ${color}`}>{value}</span>
    </div>
  );
}

const DAYS = [60, 120, 250] as const;

interface Props {
  ticker: string;
  name: string;
}

export function StockAnalysisSection({ ticker, name }: Props) {
  const [days, setDays] = useState<60 | 120 | 250>(120);
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");
  const [investorData, setInvestorData] = useState<{
    rows: { date: string; foreignNet: number; instNet: number }[];
    foreign5d: number;
    inst5d: number;
  } | null>(null);

  const fetchData = useCallback(async (t: string, d: number) => {
    if (!t) return;
    setLoading(true);
    setError("");
    setSeries(null);
    setSummary(null);
    setAiText("");
    setAiError("");
    setInvestorData(null);
    try {
      const [chartRes, invRes] = await Promise.allSettled([
        fetch(`/api/analysis-data?ticker=${t}&days=${d}`),
        fetch(`/api/kis/investor?ticker=${t}`),
      ]);
      if (chartRes.status === "fulfilled") {
        const data = await chartRes.value.json();
        if (data.error) setError(data.error);
        else {
          setSeries(data.series);
          setSummary(data.summary);
        }
      } else {
        setError("데이터 조회 중 오류 발생");
      }
      if (invRes.status === "fulfilled") {
        const invData = await invRes.value.json();
        if (!invData.error) setInvestorData(invData);
      }
    } catch {
      setError("데이터 조회 중 오류 발생");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticker) fetchData(ticker, days);
  }, [ticker, days, fetchData]);

  async function fetchAI() {
    if (!ticker) return;
    setAiLoading(true);
    setAiError("");
    setAiText("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, name }),
      });
      const data = await res.json();
      if (data.error) setAiError(data.error);
      else setAiText(data.analysis ?? "");
    } catch {
      setAiError("AI 분석 중 오류 발생");
    } finally {
      setAiLoading(false);
    }
  }

  const s = summary;
  const sign = (v: number) => (v > 0 ? "+" : "");

  return (
    <section className="mt-8 pt-6 border-t border-[#ebebeb]">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-[#191919]">종목 분석</h2>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                days === d
                  ? "bg-[#191919] text-white"
                  : "bg-white text-[#555] hover:bg-gray-100 shadow-sm"
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#3182f6] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-[#7b7b7b]">지표 계산 중...</p>
        </div>
      )}

      {error && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#f04452]/20 mb-4">
          <p className="text-sm text-[#f04452]">{error}</p>
        </div>
      )}

      {s && series && (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs text-[#7b7b7b]">종합 시그널 점수</p>
              <span className="text-xs text-[#b0b0b8]">{s.date} · {days}일 기준</span>
            </div>
            <ScoreBar score={s.score} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="mb-1">
                <LabelWithHelp label="추세" helpKey="추세" />
              </p>
              <p
                className={`text-base font-bold ${
                  s.trend === "상승" ? "text-[#f04452]" : s.trend === "하락" ? "text-[#2979ff]" : "text-[#555]"
                }`}
              >
                {s.trend}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="mb-1">
                <LabelWithHelp label="RSI (14)" helpKey="RSI" />
              </p>
              <p
                className={`text-base font-bold num ${
                  s.rsi > 70 ? "text-[#f04452]" : s.rsi < 30 ? "text-[#2979ff]" : "text-[#191919]"
                }`}
              >
                {s.rsi.toFixed(1)}
              </p>
              <p className="text-xs text-[#b0b0b8] mt-0.5">
                {s.rsi > 70 ? "과매수" : s.rsi < 30 ? "과매도" : "중립"}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="mb-1">
                <LabelWithHelp label="거래량 비율" helpKey="거래량" />
              </p>
              <p
                className={`text-base font-bold num ${
                  s.volRatio >= 2 ? "text-[#f04452]" : s.volRatio >= 1.2 ? "text-[#3182f6]" : "text-[#191919]"
                }`}
              >
                {s.volRatio.toFixed(2)}x
              </p>
              <p className="text-xs text-[#b0b0b8] mt-0.5">20일 평균 대비</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="mb-1">
                <LabelWithHelp label="5일 수익률" helpKey="5일 수익률" />
              </p>
              <p className={`text-base font-bold num ${signColor(s.ret5d)}`}>
                {sign(s.ret5d)}
                {s.ret5d.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-[#191919] mb-3">시그널 분석</h3>
            {signalRow(
              "추세",
              s.trend,
              s.trend === "상승" ? "text-[#f04452]" : s.trend === "하락" ? "text-[#2979ff]" : "text-[#555]"
            )}
            {signalRow(
              "RSI",
              `${s.rsi.toFixed(1)} — ${s.rsi > 70 ? "과매수 주의" : s.rsi < 30 ? "과매도 반등 가능" : "정상 범위"}`,
              s.rsi > 70 ? "text-[#f04452]" : s.rsi < 30 ? "text-[#3182f6]" : "text-[#555]"
            )}
            {signalRow(
              "볼린저밴드",
              `BB 위치 ${s.bbPos.toFixed(0)}% — ${s.bbPos > 80 ? "상단 돌파" : s.bbPos < 20 ? "하단 근접" : "중간 밴드"}`,
              s.bbPos > 80 ? "text-[#f04452]" : s.bbPos < 20 ? "text-[#3182f6]" : "text-[#555]"
            )}
            {signalRow(
              "MACD",
              `히스토그램 ${s.macdHist > 0 ? "양전환 ↑" : "음전환 ↓"}`,
              s.macdHist > 0 ? "text-[#f04452]" : "text-[#2979ff]"
            )}
            {signalRow(
              "거래량",
              `${s.volRatio.toFixed(2)}x — ${s.volRatio >= 2 ? "강한 거래량 돌파" : s.volRatio >= 1.2 ? "거래량 증가" : "평이한 거래량"}`,
              s.volRatio >= 2 ? "text-[#f04452]" : s.volRatio >= 1.2 ? "text-[#3182f6]" : "text-[#555]"
            )}
            {signalRow("5일 수익률", `${sign(s.ret5d)}${s.ret5d.toFixed(2)}%`, signColor(s.ret5d))}
          </div>

          {investorData && (
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <h3 className="text-sm font-semibold text-[#191919] mb-3">수급 현황</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#fafafa] rounded-xl p-3">
                  <p className="text-xs text-[#7b7b7b] mb-1">외국인 5일 순매수</p>
                  <p
                    className={`text-lg font-bold num ${
                      investorData.foreign5d > 0
                        ? "text-[#f04452]"
                        : investorData.foreign5d < 0
                          ? "text-[#2979ff]"
                          : "text-[#555]"
                    }`}
                  >
                    {investorData.foreign5d > 0 ? "+" : ""}
                    {investorData.foreign5d.toLocaleString()}주
                  </p>
                </div>
                <div className="bg-[#fafafa] rounded-xl p-3">
                  <p className="text-xs text-[#7b7b7b] mb-1">기관 5일 순매수</p>
                  <p
                    className={`text-lg font-bold num ${
                      investorData.inst5d > 0
                        ? "text-[#f04452]"
                        : investorData.inst5d < 0
                          ? "text-[#2979ff]"
                          : "text-[#555]"
                    }`}
                  >
                    {investorData.inst5d > 0 ? "+" : ""}
                    {investorData.inst5d.toLocaleString()}주
                  </p>
                </div>
              </div>
              {investorData.foreign5d > 0 && investorData.inst5d > 0 && (
                <div className="mb-3 text-xs px-3 py-1.5 rounded-lg font-semibold bg-[#f04452]/10 text-[#f04452]">
                  외국인·기관 동반 매수 — 강한 수급 신호
                </div>
              )}
              {investorData.foreign5d < 0 && investorData.inst5d < 0 && (
                <div className="mb-3 text-xs px-3 py-1.5 rounded-lg font-semibold bg-[#2979ff]/10 text-[#2979ff]">
                  외국인·기관 동반 매도 — 수급 주의
                </div>
              )}
              <div className="space-y-1">
                <div className="grid grid-cols-3 text-[10px] text-[#b0b0b8] pb-1">
                  <span>날짜</span>
                  <span className="text-right">외국인</span>
                  <span className="text-right">기관</span>
                </div>
                {investorData.rows.slice(-5).map((row) => (
                  <div key={row.date} className="grid grid-cols-3 text-xs py-1 border-t border-[#f5f5f5]">
                    <span className="text-[#b0b0b8]">{row.date.slice(5)}</span>
                    <span
                      className={`text-right num font-medium ${
                        row.foreignNet > 0 ? "text-[#f04452]" : row.foreignNet < 0 ? "text-[#2979ff]" : "text-[#555]"
                      }`}
                    >
                      {row.foreignNet > 0 ? "+" : ""}
                      {row.foreignNet.toLocaleString()}
                    </span>
                    <span
                      className={`text-right num font-medium ${
                        row.instNet > 0 ? "text-[#f04452]" : row.instNet < 0 ? "text-[#2979ff]" : "text-[#555]"
                      }`}
                    >
                      {row.instNet > 0 ? "+" : ""}
                      {row.instNet.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-[#191919] mb-3">주요 지표</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="MA5" value={s.ma5 ? fmt(Math.round(s.ma5)) : "-"} />
              <MetricCard label="MA20" value={s.ma20 ? fmt(Math.round(s.ma20)) : "-"} />
              <MetricCard label="MA60" value={s.ma60 ? fmt(Math.round(s.ma60)) : "-"} />
              <MetricCard label="ATR (14)" value={s.atr ? fmt(Math.round(s.atr)) : "-"} sub="변동성 기준" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#191919]">AI 분석 의견</h3>
              <Button
                onClick={fetchAI}
                disabled={aiLoading}
                size="sm"
                className="bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl h-8 px-4 text-xs"
              >
                {aiLoading ? "분석 중..." : "AI 분석 요청"}
              </Button>
            </div>
            {aiError && <p className="text-sm text-[#f04452]">{aiError}</p>}
            {aiText && (
              <>
                <p className="text-sm text-[#555] leading-relaxed whitespace-pre-wrap">{aiText}</p>
                <p className="text-xs text-[#b0b0b8] mt-4">본 분석은 AI 생성 콘텐츠로 투자 권유가 아닙니다.</p>
              </>
            )}
            {!aiText && !aiError && !aiLoading && (
              <p className="text-sm text-[#b0b0b8]">위 버튼을 눌러 AI 종목 분석을 요청하세요.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
