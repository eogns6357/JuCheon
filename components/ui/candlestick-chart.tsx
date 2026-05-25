"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export interface CandleRow {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: CandleRow[];
  height?: number;
  showTime?: boolean;
}

export function CandlestickChart({ data, height = 380, showTime = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#7b7b7b",
      },
      grid: {
        vertLines: { color: "#f5f5f5" },
        horzLines: { color: "#f5f5f5" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: showTime,
        secondsVisible: false,
        // Allow scrolling all the way to the beginning
        rightOffset: 5,
        barSpacing: 6,
        minBarSpacing: 1,
      },
      // Mouse wheel → zoom (scale), click+drag → pan
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: false,      // disabled: wheel is for zoom only
        pressedMouseMove: true, // pan with click+drag
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#f04452",
      downColor: "#2979ff",
      borderUpColor: "#f04452",
      borderDownColor: "#2979ff",
      wickUpColor: "#f04452",
      wickDownColor: "#2979ff",
    });
    candleSeries.setData(
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    if (data[0]?.volume !== undefined) {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: "#3182f6",
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volSeries.setData(
        data.map((d) => ({
          time: d.time as Time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? "#f0445240" : "#2979ff40",
        }))
      );
    }

    // Show all data on initial load
    chart.timeScale().fitContent();

    // Double-click resets to show all data
    containerRef.current.addEventListener("dblclick", () => {
      chart.timeScale().fitContent();
    });

    // Responsive resize
    const obs = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      chart.remove();
    };
  }, [data, height, showTime]);

  function fitAll() {
    chartRef.current?.timeScale().fitContent();
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" style={{ height }} />
      {/* Fit-all button */}
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
  );
}
