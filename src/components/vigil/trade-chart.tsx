/**
 * TradingView Lightweight Charts — candlesticks + volume + trade markers.
 * Paper Demo only. Candles observed from Bitget.
 */
import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export type ChartCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartMarker = {
  ts: number;
  px: number;
  kind: "entry" | "exit";
  side: string;
  id: string;
  label?: string;
};

function toUtc(ts: number): UTCTimestamp {
  return Math.floor(ts / 1000) as UTCTimestamp;
}


/** Brand-safe hex palette (TV charts reject oklch). */
const TV = {
  bg: "#fafafa",
  fg: "#171717",
  muted: "#737373",
  border: "#e5e5e5",
  primary: "#06b6d4",
  up: "#0d9488",
  down: "#e11d48",
} as const;

export function VigilCandleChart({
  candles,
  markers = [],
  height = 380,
  className,
}: {
  candles: ChartCandle[];
  markers?: ChartMarker[];
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: TV.bg },
        textColor: TV.muted,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: TV.border },
        horzLines: { color: TV.border },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV.primary, width: 1, style: 2, labelBackgroundColor: TV.fg },
        horzLine: { color: TV.primary, width: 1, style: 2, labelBackgroundColor: TV.fg },
      },
      rightPriceScale: {
        borderColor: TV.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: TV.border,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: TV.up,
      downColor: TV.down,
      borderUpColor: TV.up,
      borderDownColor: TV.down,
      wickUpColor: TV.up,
      wickDownColor: TV.down,
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volRef.current = volSeries;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: hostRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleRef.current || !volRef.current || !chartRef.current) return;
    if (!candles.length) {
      candleRef.current.setData([]);
      volRef.current.setData([]);
      return;
    }

    const sorted = [...candles].sort((a, b) => a.ts - b.ts);
    const byTime = new Map<number, (typeof sorted)[number]>();
    for (const c of sorted) byTime.set(toUtc(c.ts) as number, c);
    const unique = [...byTime.values()].sort((a, b) => a.ts - b.ts);
    const candleData = unique.map((c) => ({
      time: toUtc(c.ts),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volData = unique.map((c) => {
      const up = c.close >= c.open;
      return {
        time: toUtc(c.ts),
        value: c.volume ?? 0,
        color: up ? "rgba(13, 148, 136, 0.35)" : "rgba(225, 29, 72, 0.35)",
      };
    });
    candleRef.current.setData(candleData);
    volRef.current.setData(volData);

    const seriesMarkers: SeriesMarker<Time>[] = markers
      .map((m) => {
        const time = toUtc(m.ts);
        const isEntry = m.kind === "entry";
        const buy = m.side === "buy";
        return {
          time,
          position: isEntry
            ? buy
              ? ("belowBar" as const)
              : ("aboveBar" as const)
            : buy
              ? ("aboveBar" as const)
              : ("belowBar" as const),
          color: isEntry ? TV.up : TV.down,
          shape: isEntry
            ? buy
              ? ("arrowUp" as const)
              : ("arrowDown" as const)
            : ("circle" as const),
          text: m.label ?? (isEntry ? (buy ? "BUY" : "SELL") : "EXIT"),
          size: 1.25,
        };
      })
      .sort((a, b) => Number(a.time) - Number(b.time));

    // One marker family per bar time (TV requires strictly increasing times for markers)
    const byBar = new Map<number, SeriesMarker<Time>>();
    for (const m of seriesMarkers) {
      byBar.set(Number(m.time), m);
    }
    createSeriesMarkers(
      candleRef.current,
      [...byBar.values()].sort((a, b) => Number(a.time) - Number(b.time)),
    );
    chartRef.current.timeScale().fitContent();
  }, [candles, markers]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ height, width: "100%" }}
      data-chart="tradingview-candles"
    />
  );
}

export function VigilEquityChart({
  points,
  height = 200,
  className,
}: {
  points: Array<{ ts: number; equity: number }>;
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: TV.bg },
        textColor: TV.muted,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: TV.border },
        horzLines: { color: TV.border },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: TV.border },
      timeScale: { borderColor: TV.border, timeVisible: true },
    });

    const series = chart.addSeries(LineSeries, {
      color: TV.primary,
      lineWidth: 2,
      crosshairMarkerVisible: true,
    });

    const sorted = [...points].sort((a, b) => a.ts - b.ts);
    const byTime = new Map<number, number>();
    for (const p of sorted) byTime.set(toUtc(p.ts) as number, p.equity);
    series.setData(
      [...byTime.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as UTCTimestamp, value })),
    );
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [points, height]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ height, width: "100%" }}
      data-chart="tradingview-equity"
    />
  );
}
