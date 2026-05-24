"""
스크리닝 전략 3가지:
1. 거래량 돌파: 거래량 급증 + 20일선 위 + RSI 정상 → 단기 모멘텀
2. 골든크로스: 5MA > 20MA 교차 → 추세 전환
3. 눌림목: 단기 조정 후 반등 → 저점 매수
"""
import pandas as pd
import numpy as np
from pykrx import stock
from datetime import datetime, timedelta
import time
from core.data import date_ago, today, get_ohlcv
from core.indicators import add_indicators

def _fetch_and_score(ticker: str, name: str, market: str) -> dict | None:
    try:
        df = get_ohlcv(ticker, days=80)
        if len(df) < 40:
            return None
        df = add_indicators(df)
        row = df.iloc[-1]
        prev = df.iloc[-2]

        c = float(row["종가"])
        vol = float(row["거래량"])
        vma20 = float(row["VMA20"]) if not pd.isna(row["VMA20"]) else 0
        rsi = float(row["RSI"]) if not pd.isna(row["RSI"]) else 50
        ma5 = float(row["MA5"]) if not pd.isna(row["MA5"]) else c
        ma20 = float(row["MA20"]) if not pd.isna(row["MA20"]) else c
        ma60 = float(row["MA60"]) if not pd.isna(row["MA60"]) else c
        macd = float(row["MACD"]) if not pd.isna(row["MACD"]) else 0
        macd_sig = float(row["MACD_signal"]) if not pd.isna(row["MACD_signal"]) else 0
        prev_macd = float(prev["MACD"]) if not pd.isna(prev["MACD"]) else 0
        prev_sig = float(prev["MACD_signal"]) if not pd.isna(prev["MACD_signal"]) else 0
        vol_ratio = vol / vma20 if vma20 > 0 else 1
        ret_5d = float(row["ret_5d"]) if not pd.isna(row["ret_5d"]) else 0
        ret_1d = float(row["ret_1d"]) if not pd.isna(row["ret_1d"]) else 0

        # --- 전략 1: 거래량 돌파 ---
        s1 = (vol_ratio >= 2.0 and c > ma20 and 35 < rsi < 72 and ret_1d > 0)

        # --- 전략 2: 골든크로스 ---
        prev_ma5 = float(prev["MA5"]) if not pd.isna(prev["MA5"]) else ma5
        prev_ma20 = float(prev["MA20"]) if not pd.isna(prev["MA20"]) else ma20
        golden = (ma5 > ma20 and prev_ma5 <= prev_ma20)
        s2 = golden or (macd > macd_sig and prev_macd <= prev_sig and c > ma20)

        # --- 전략 3: 눌림목 반등 ---
        high_20 = df["종가"].tail(20).max()
        pullback_pct = (c - high_20) / high_20 * 100
        s3 = (-15 < pullback_pct < -3 and c > ma60 and rsi > 40 and
              macd > macd_sig and vol_ratio > 1.2)

        strategy = []
        if s1: strategy.append("거래량돌파")
        if s2: strategy.append("골든크로스" if golden else "MACD전환")
        if s3: strategy.append("눌림목반등")

        if not strategy:
            return None

        # 점수 계산
        score = 0
        if c > ma5: score += 15
        if c > ma20: score += 20
        if c > ma60: score += 10
        if 40 < rsi < 65: score += 15
        elif 65 <= rsi < 72: score += 5
        if macd > macd_sig: score += 15
        if vol_ratio >= 2: score += 15
        elif vol_ratio >= 1.5: score += 8
        if ret_5d > 0: score += 10

        return {
            "티커": ticker,
            "종목명": name,
            "시장": market,
            "현재가": int(c),
            "등락률": round(ret_1d, 2),
            "5일수익률": round(ret_5d, 2),
            "거래량비율": round(vol_ratio, 1),
            "RSI": round(rsi, 1),
            "전략": " + ".join(strategy),
            "점수": score,
        }
    except Exception:
        return None


def run_screener(market: str = "ALL", max_stocks: int = 200,
                 progress_cb=None) -> pd.DataFrame:
    from core.data import get_all_tickers
    tickers = get_all_tickers(market)
    if max_stocks:
        tickers = tickers[:max_stocks]

    results = []
    total = len(tickers)
    for i, (ticker, name, mkt) in enumerate(tickers):
        if progress_cb:
            progress_cb(i + 1, total, name)
        result = _fetch_and_score(ticker, name, mkt)
        if result:
            results.append(result)
        time.sleep(0.05)

    if not results:
        return pd.DataFrame()

    df = pd.DataFrame(results)
    df = df.sort_values("점수", ascending=False).reset_index(drop=True)
    return df
