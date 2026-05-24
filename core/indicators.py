import pandas as pd
import numpy as np

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    c = df["종가"].astype(float)
    v = df["거래량"].astype(float)

    # 이동평균
    for n in [5, 20, 60, 120]:
        df[f"MA{n}"] = c.rolling(n).mean()

    # 거래량 이동평균
    df["VMA20"] = v.rolling(20).mean()
    df["VMA5"] = v.rolling(5).mean()

    # RSI (14)
    df["RSI"] = _rsi(c, 14)

    # MACD
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    df["MACD"] = ema12 - ema26
    df["MACD_signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
    df["MACD_hist"] = df["MACD"] - df["MACD_signal"]

    # 볼린저밴드 (20, 2σ)
    ma20 = c.rolling(20).mean()
    std20 = c.rolling(20).std()
    df["BB_upper"] = ma20 + 2 * std20
    df["BB_lower"] = ma20 - 2 * std20
    df["BB_mid"] = ma20
    df["BB_pct"] = (c - df["BB_lower"]) / (df["BB_upper"] - df["BB_lower"])

    # ATR (14) - 변동성
    high = df["고가"].astype(float)
    low = df["저가"].astype(float)
    tr = pd.concat([high - low,
                    (high - c.shift()).abs(),
                    (low - c.shift()).abs()], axis=1).max(axis=1)
    df["ATR"] = tr.rolling(14).mean()

    # 거래량 비율 (오늘 거래량 / 20일 평균)
    df["vol_ratio"] = v / df["VMA20"]

    # 수익률
    df["ret_1d"] = c.pct_change(1) * 100
    df["ret_5d"] = c.pct_change(5) * 100
    df["ret_20d"] = c.pct_change(20) * 100

    # 52주 고저 위치
    df["high_52w"] = c.rolling(252).max()
    df["low_52w"] = c.rolling(252).min()
    df["pos_52w"] = (c - df["low_52w"]) / (df["high_52w"] - df["low_52w"]) * 100

    return df

def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def signal_summary(df: pd.DataFrame) -> dict:
    """마지막 행 기준 매매 신호 요약"""
    row = df.iloc[-1]
    prev = df.iloc[-2] if len(df) >= 2 else row
    signals = {}

    # 추세
    signals["추세"] = "상승" if row["종가"] > row["MA20"] > row["MA60"] else \
                     "하락" if row["종가"] < row["MA20"] < row["MA60"] else "중립"

    # RSI
    rsi = row["RSI"]
    signals["RSI"] = f"{rsi:.1f} " + ("과매수⚠" if rsi > 70 else "과매도" if rsi < 30 else "정상")

    # MACD
    signals["MACD"] = "골든크로스🟢" if (row["MACD"] > row["MACD_signal"] and
                                           prev["MACD"] <= prev["MACD_signal"]) else \
                      "데드크로스🔴" if (row["MACD"] < row["MACD_signal"] and
                                          prev["MACD"] >= prev["MACD_signal"]) else \
                      "상승중" if row["MACD"] > row["MACD_signal"] else "하락중"

    # 볼린저
    bp = row["BB_pct"]
    signals["볼린저"] = f"{bp*100:.0f}% " + ("상단돌파⚠" if bp > 1 else "하단" if bp < 0 else "중간")

    # 거래량
    vr = row["vol_ratio"]
    signals["거래량"] = f"{vr:.1f}배 " + ("급증🔥" if vr > 3 else "증가" if vr > 1.5 else "보통")

    # 종합 점수 (0~100)
    score = 50
    if row["종가"] > row["MA5"]: score += 5
    if row["종가"] > row["MA20"]: score += 10
    if row["종가"] > row["MA60"]: score += 5
    if 40 < rsi < 70: score += 10
    if row["MACD"] > row["MACD_signal"]: score += 10
    if vr > 1.5: score += 10
    if row["MACD_hist"] > prev["MACD_hist"]: score += 5
    if row["ret_5d"] > 0: score += 5
    score = min(100, max(0, score))
    signals["종합점수"] = score

    return signals
