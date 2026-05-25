"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

export interface SeriesPoint {
  date: string;
  open: number; high: number; low: number; close: number; volume: number;
  vma20: number | null;
  rsi: number | null;
  macd: number | null; macdSignal: number | null; macdHist: number | null;
  bbUpper: number | null; bbMiddle: number | null; bbLower: number | null;
  ma5: number | null; ma20: number | null; ma60: number | null; ma120: number | null;
}

interface Props {
  data: SeriesPoint[];
}

function setLine(
  chart: IChartApi,
  points: { time: string; value: number | null | undefined }[],
  color: string,
  lineWidth: 1 | 2 | 3 = 1,
  dashed = false
) {
  const filtered = points.filter((p) => p.value != null) as { time: string; value: number }[];
  if (filtered.length === 0) return;
  const s = chart.addSeries(LineSeries, {
    color,
    lineWidth,
    lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  s.setData(filtered.map((p) => ({ time: p.time as Time, value: p.value })));
}

export function AnalysisChart({ data }: Props) {
  const candleRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const candleChartRef = useRef<IChartApi | null>(null);
  const volChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!candleRef.current || !volRef.current || data.length === 0) return;

    const baseOpts = {
      layout: { background: { color: "#ffffff" }, textColor: "#7b7b7b" },
      grid: { vertLines: { color: "#f5f5f5" }, horzLines: { color: "#f5f5f5" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false, rightOffset: 5, barSpacing: 6, minBarSpacing: 1 },
      crosshair: { mode: 1 as const },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    };

    // ── Candle chart ────────────────────────────────────────────────
    const cChart = createChart(candleRef.current, { ...baseOpts, height: 380 });
    candleChartRef.current = cChart;

    const candleSeries = cChart.addSeries(CandlestickSeries, {
      upColor: "#f04452",
      downColor: "#2979ff",
      borderUpColor: "#f04452",
      borderDownColor: "#2979ff",
      wickUpColor: "#f04452",
      wickDownColor: "#2979ff",
    });
    candleSeries.setData(
      data.map((d) => ({ time: d.date as Time, open: d.open, high: d.high, low: d.low, close: d.close }))
    );

    // MA overlays
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.ma5 })),  "#f59e0b", 1);
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.ma20 })), "#10b981", 1);
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.ma60 })), "#3182f6", 1);
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.ma120 })), "#8b5cf6", 1);

    // BB overlays (dashed)
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.bbUpper })),  "#94a3b8", 1, true);
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.bbMiddle })), "#64748b", 1, true);
    setLine(cChart, data.map((d) => ({ time: d.date, value: d.bbLower })),  "#94a3b8", 1, true);

    cChart.timeScale().fitContent();

    // ── Volume chart ─────────────────────────────────────────────────
    const vChart = createChart(volRef.current, { ...baseOpts, height: 120 });
    volChartRef.current = vChart;

    const volSeries = vChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" as const },
      priceScaleId: "right",
    });
    volSeries.setData(
      data.map((d) => ({
        time: d.date as Time,
        value: d.volume,
        color: d.close >= d.open ? "#f0445250" : "#2979ff50",
      }))
    );

    // VMA20
    setLine(vChart, data.map((d) => ({ time: d.date, value: d.vma20 })), "#f59e0b", 1);

    vChart.timeScale().fitContent();

    candleRef.current.addEventListener("dblclick", () => {
      cChart.timeScale().fitContent();
      vChart.timeScale().fitContent();
    });

    // Sync time ranges between charts
    let syncing = false;
    const syncRange = (src: IChartApi, dst: IChartApi) => {
      src.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (syncing) return;
        syncing = true;
        const range = src.timeScale().getVisibleRange();
        if (range) dst.timeScale().setVisibleRange(range);
        syncing = false;
      });
    };
    syncRange(cChart, vChart);
    syncRange(vChart, cChart);

    // Resize observer
    const obs = new ResizeObserver(() => {
      const w = candleRef.current?.clientWidth;
      if (w) {
        cChart.applyOptions({ width: w });
        vChart.applyOptions({ width: w });
      }
    });
    obs.observe(candleRef.current);

    return () => {
      obs.disconnect();
      cChart.remove();
      vChart.remove();
    };
  }, [data]);

  function fitAll() {
    candleChartRef.current?.timeScale().fitContent();
    volChartRef.current?.timeScale().fitContent();
  }

  // Recharts data for RSI + MACD panels
  const rcData = data.map((d, i) => ({
    i,
    date: d.date.slice(5),
    rsi: d.rsi != null ? +d.rsi.toFixed(1) : null,
    macdHist: d.macdHist != null ? +d.macdHist.toFixed(0) : null,
    macd: d.macd != null ? +d.macd.toFixed(0) : null,
    macdSig: d.macdSignal != null ? +d.macdSignal.toFixed(0) : null,
  }));

  const tickStep = Math.round(data.length / 5);
  const tickFmt = (v: string, i: number) => (i % tickStep === 0 ? v : "");

  return (
    <div className="space-y-1">
      {/* Candlestick + MA + BB */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-2 px-1">
          {[
            { label: "MA5", color: "#f59e0b" },
            { label: "MA20", color: "#10b981" },
            { label: "MA60", color: "#3182f6" },
            { label: "MA120", color: "#8b5cf6" },
            { label: "BB", color: "#94a3b8" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className="inline-block w-4 h-[2px] rounded" style={{ background: l.color }} />
              <span className="text-[#7b7b7b]">{l.label}</span>
            </span>
          ))}
        </div>
        <div className="relative">
          <div ref={candleRef} className="w-full" />
          <button
            onClick={fitAll}
            title="전체 보기 (더블클릭도 가능)"
            className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white border border-[#ebebeb] rounded-lg px-2 py-1 text-[11px] text-[#555] shadow-sm transition-colors"
          >
            전체
          </button>
          <p className="absolute bottom-1 right-2 text-[10px] text-[#c0c0c8] pointer-events-none">
            휠: 확대/축소 &nbsp;·&nbsp; 드래그: 이동
          </p>
        </div>
      </div>

      {/* Volume */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <p className="text-xs text-[#7b7b7b] font-semibold mb-1 px-1">
          거래량 <span className="text-[#f59e0b]">— VMA20</span>
        </p>
        <div ref={volRef} className="w-full" />
      </div>

      {/* RSI */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <p className="text-xs text-[#7b7b7b] font-semibold mb-1 px-1">RSI (14)</p>
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={rcData} margin={{ left: -10, right: 10, top: 4, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} ticks={[0, 30, 50, 70, 100]} />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, border: "none", boxShadow: "0 2px 8px #0001" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [Number(v).toFixed(1), "RSI"] as any}
              labelFormatter={() => ""}
            />
            <ReferenceLine y={70} stroke="#f04452" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={30} stroke="#3182f6" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={50} stroke="#b0b0b8" strokeDasharray="2 4" strokeOpacity={0.35} />
            <Line type="monotone" dataKey="rsi" stroke="#f59e0b" dot={false} strokeWidth={1.5} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MACD */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex gap-3 text-xs mb-1 px-1">
          <span className="text-[#7b7b7b] font-semibold">MACD</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-[2px] rounded bg-[#3182f6]" />
            <span className="text-[#7b7b7b]">MACD</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-[2px] rounded bg-[#f59e0b]" />
            <span className="text-[#7b7b7b]">Signal</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={rcData} margin={{ left: -10, right: 10, top: 4, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, border: "none", boxShadow: "0 2px 8px #0001" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => [Number(v).toFixed(0), name === "macdHist" ? "히스토그램" : name === "macd" ? "MACD" : "시그널"] as any}
              labelFormatter={() => ""}
            />
            <ReferenceLine y={0} stroke="#b0b0b8" strokeOpacity={0.5} />
            <Bar dataKey="macdHist" maxBarSize={4}>
              {rcData.map((d, i) => (
                <Cell key={i} fill={(d.macdHist ?? 0) >= 0 ? "#f04452" : "#2979ff"} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="macd" stroke="#3182f6" dot={false} strokeWidth={1.5} connectNulls />
            <Line type="monotone" dataKey="macdSig" stroke="#f59e0b" dot={false} strokeWidth={1} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
