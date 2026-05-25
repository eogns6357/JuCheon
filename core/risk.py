"""
리스크 관리 계산기
- 포지션 사이즈 (자본 × 위험비율 / 손절폭)
- 목표가 / 손절가
- 손익비 검증
"""

def calculate_position(
    capital: float,
    entry: float,
    stop_loss: float,
    risk_pct: float = 1.0,  # 자본 대비 최대 손실 %
) -> dict:
    if entry <= 0 or stop_loss <= 0 or stop_loss >= entry:
        return {}

    risk_amount = capital * (risk_pct / 100)
    loss_per_share = entry - stop_loss
    shares = int(risk_amount / loss_per_share)
    position_value = shares * entry
    actual_loss = shares * loss_per_share
    position_pct = position_value / capital * 100

    return {
        "매수수량": shares,
        "포지션금액": int(position_value),
        "포지션비율": round(position_pct, 1),
        "최대손실액": int(actual_loss),
        "손절가": stop_loss,
        "손절폭": round((entry - stop_loss) / entry * 100, 2),
    }

def calculate_targets(entry: float, stop_loss: float) -> dict:
    risk = entry - stop_loss
    return {
        "목표1 (1:1.5)": round(entry + risk * 1.5),
        "목표2 (1:2)": round(entry + risk * 2),
        "목표3 (1:3)": round(entry + risk * 3),
        "손익비1.5": round((entry + risk * 1.5 - entry) / (entry - stop_loss), 2),
    }

def atr_stop(df_with_indicators, multiplier: float = 1.5) -> float:
    """ATR 기반 손절가"""
    atr = df_with_indicators["ATR"].iloc[-1]
    close = df_with_indicators["종가"].iloc[-1]
    return round(close - atr * multiplier)

def support_stop(df, lookback: int = 10) -> float:
    """최근 N일 저점 기반 손절가"""
    return float(df["저가"].tail(lookback).min())

def rrr_ok(entry: float, target: float, stop: float, min_rrr: float = 2.0) -> bool:
    """손익비 최소 기준 통과 여부"""
    if entry <= stop:
        return False
    rrr = (target - entry) / (entry - stop)
    return rrr >= min_rrr
