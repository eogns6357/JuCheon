import pandas as pd
import numpy as np
from pykrx import stock
from datetime import datetime, timedelta
import time

def today():
    return datetime.now().strftime("%Y%m%d")

def date_ago(days: int) -> str:
    return (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")

def get_ohlcv(ticker: str, days: int = 120) -> pd.DataFrame:
    df = stock.get_market_ohlcv(date_ago(days * 2), today(), ticker)
    df = df[df["거래량"] > 0].tail(days)
    df.index = pd.to_datetime(df.index)
    return df

def get_ticker_name(ticker: str) -> str:
    try:
        return stock.get_market_ticker_name(ticker)
    except:
        return ticker

import FinanceDataReader as fdr

_ticker_df = None   # 전체 종목 DataFrame (Code, Name)

def _get_ticker_df():
    global _ticker_df
    if _ticker_df is None:
        df = fdr.StockListing('KRX')[['Code', 'Name']].dropna()
        df = df[df['Code'].str.match(r'^\d{6}$')]  # 숫자 6자리만
        _ticker_df = df
    return _ticker_df


def search_ticker(query: str) -> list[tuple[str, str]]:
    """
    회사명 부분 검색 → [(ticker, name), ...]
    - 'GS'    → GS, GS건설, GS리테일, GS피앤엘 ...
    - '하이닉스' → SK하이닉스
    """
    q = query.strip()
    if not q:
        return []
    df = _get_ticker_df()
    matched = df[df['Name'].str.contains(q, na=False, regex=False)]
    # 이름이 q로 시작하는 것 우선 정렬
    starts = matched[matched['Name'].str.startswith(q)]
    others = matched[~matched['Name'].str.startswith(q)]
    result = pd.concat([starts, others])
    return [(row['Code'], row['Name']) for _, row in result.iterrows()][:50]

def get_all_tickers(market: str = "ALL") -> list[tuple]:
    """Returns list of (ticker, name, market) tuples"""
    df = _get_ticker_df()
    results = []
    for _, row in df.iterrows():
        results.append((row['Code'], row['Name'], market))
    return results

def get_market_index(days: int = 60) -> pd.DataFrame:
    df = fdr.DataReader('KS11', date_ago(days * 2))
    df = df.rename(columns={"Open": "시가", "High": "고가", "Low": "저가",
                             "Close": "종가", "Volume": "거래량"})
    df = df[df["거래량"] > 0].tail(days)
    df.index = pd.to_datetime(df.index)
    return df

def get_kosdaq_index(days: int = 60) -> pd.DataFrame:
    df = fdr.DataReader('KQ11', date_ago(days * 2))
    df = df.rename(columns={"Open": "시가", "High": "고가", "Low": "저가",
                             "Close": "종가", "Volume": "거래량"})
    df = df[df["거래량"] > 0].tail(days)
    df.index = pd.to_datetime(df.index)
    return df

def get_sector_performance() -> pd.DataFrame:
    """업종별 등락률"""
    try:
        df = stock.get_index_ohlcv(date_ago(5), today(), "1028")
        return df
    except:
        return pd.DataFrame()

def get_market_cap_df(market: str = "KOSPI") -> pd.DataFrame:
    return stock.get_market_cap(today(), market=market)
