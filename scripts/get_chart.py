#!/usr/bin/env python3
"""
Return OHLCV candle data via FinanceDataReader.
Usage: python get_chart.py <ticker> <period>
period: D | W | M | Y
"""
import sys, json
import FinanceDataReader as fdr
from datetime import datetime, timedelta

def main():
    ticker = sys.argv[1] if len(sys.argv) > 1 else "005930"
    period = sys.argv[2] if len(sys.argv) > 2 else "D"

    lookback_years = {"D": 10, "W": 20, "M": 30, "Y": 50}.get(period, 10)
    start = (datetime.now() - timedelta(days=lookback_years * 365)).strftime("%Y-%m-%d")

    df = fdr.DataReader(ticker, start)
    if df is None or df.empty:
        print(json.dumps([]))
        return

    # Resample for non-daily periods
    agg = {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}
    rule = {"W": "W-FRI", "M": "ME", "Y": "YE"}.get(period)
    if rule:
        df = df.resample(rule).agg(agg).dropna()

    candles = []
    for date, row in df.iterrows():
        close = int(row["Close"])
        if close <= 0:
            continue
        candles.append({
            "time":   date.strftime("%Y-%m-%d"),
            "open":   int(row["Open"])   or close,
            "high":   int(row["High"])   or close,
            "low":    int(row["Low"])    or close,
            "close":  close,
            "volume": int(row["Volume"]),
        })

    print(json.dumps(candles, ensure_ascii=False))

if __name__ == "__main__":
    main()
