import pandas as pd
import os
from datetime import datetime

JOURNAL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "journal.csv")

COLS = ["날짜", "종목명", "티커", "매수가", "매도가", "수량", "손익", "수익률",
        "전략", "손절가", "목표가", "메모", "결과"]

def load() -> pd.DataFrame:
    if os.path.exists(JOURNAL_PATH):
        df = pd.read_csv(JOURNAL_PATH, encoding="utf-8-sig")
        for c in COLS:
            if c not in df.columns:
                df[c] = ""
        return df
    return pd.DataFrame(columns=COLS)

def save(df: pd.DataFrame):
    os.makedirs(os.path.dirname(JOURNAL_PATH), exist_ok=True)
    df.to_csv(JOURNAL_PATH, index=False, encoding="utf-8-sig")

def add_trade(종목명, 티커, 매수가, 수량, 손절가, 목표가, 전략="", 메모="") -> pd.DataFrame:
    df = load()
    row = {
        "날짜": datetime.now().strftime("%Y-%m-%d"),
        "종목명": 종목명, "티커": 티커,
        "매수가": 매수가, "매도가": "", "수량": 수량,
        "손익": "", "수익률": "",
        "전략": 전략, "손절가": 손절가, "목표가": 목표가,
        "메모": 메모, "결과": "보유중",
    }
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    save(df)
    return df

def close_trade(idx: int, 매도가: float) -> pd.DataFrame:
    df = load()
    if idx >= len(df):
        return df
    row = df.iloc[idx]
    매수가 = float(row["매수가"])
    수량 = int(row["수량"])
    손익 = (매도가 - 매수가) * 수량
    수익률 = (매도가 - 매수가) / 매수가 * 100
    df.at[idx, "매도가"] = 매도가
    df.at[idx, "손익"] = round(손익)
    df.at[idx, "수익률"] = round(수익률, 2)
    df.at[idx, "결과"] = "수익" if 손익 > 0 else "손실"
    save(df)
    return df

def stats(df: pd.DataFrame) -> dict:
    closed = df[df["결과"].isin(["수익", "손실"])].copy()
    if closed.empty:
        return {}
    closed["손익"] = pd.to_numeric(closed["손익"], errors="coerce").fillna(0)
    closed["수익률"] = pd.to_numeric(closed["수익률"], errors="coerce").fillna(0)
    wins = closed[closed["손익"] > 0]
    losses = closed[closed["손익"] <= 0]
    win_rate = len(wins) / len(closed) * 100 if len(closed) > 0 else 0
    avg_win = wins["수익률"].mean() if len(wins) > 0 else 0
    avg_loss = losses["수익률"].mean() if len(losses) > 0 else 0
    rrr = abs(avg_win / avg_loss) if avg_loss != 0 else 0
    return {
        "총매매": len(closed),
        "승률": round(win_rate, 1),
        "평균수익": round(avg_win, 2),
        "평균손실": round(avg_loss, 2),
        "손익비": round(rrr, 2),
        "총손익": int(closed["손익"].sum()),
        "기대값": round(win_rate/100 * avg_win + (1-win_rate/100) * avg_loss, 2),
    }
