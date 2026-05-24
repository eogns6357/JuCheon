"""
한국투자증권 KIS Developers API 연동
- REST: 현재가, 호가, 뉴스
- WebSocket: 실시간 체결가 스트리밍
"""
import requests
import json
import time
import websocket
import threading
from datetime import datetime, timedelta
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

BASE_URL = {
    "real":    "https://openapi.koreainvestment.com:9443",
    "virtual": "https://openapivts.koreainvestment.com:29443",
}
WS_URL = {
    "real":    "ws://ops.koreainvestment.com:21000",
    "virtual": "ws://ops.koreainvestment.com:31000",
}

_token_cache = {"token": None, "expires": None}


# ── 토큰 ──────────────────────────────────────────────
def get_token() -> str:
    now = datetime.now()
    if _token_cache["token"] and _token_cache["expires"] > now:
        return _token_cache["token"]

    url = BASE_URL[config.KIS_MODE] + "/oauth2/tokenP"
    body = {
        "grant_type": "client_credentials",
        "appkey": config.KIS_APP_KEY,
        "appsecret": config.KIS_APP_SECRET,
    }
    r = requests.post(url, json=body, timeout=10)
    r.raise_for_status()
    data = r.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires"] = now + timedelta(hours=23)
    return _token_cache["token"]


def _headers(tr_id: str) -> dict:
    return {
        "Content-Type": "application/json",
        "authorization": f"Bearer {get_token()}",
        "appkey": config.KIS_APP_KEY,
        "appsecret": config.KIS_APP_SECRET,
        "tr_id": tr_id,
        "custtype": "P",
    }


# ── 현재가 ────────────────────────────────────────────
def get_price(ticker: str) -> dict:
    """단일 종목 현재가 조회"""
    url = BASE_URL[config.KIS_MODE] + "/uapi/domestic-stock/v1/quotations/inquire-price"
    params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker}
    r = requests.get(url, headers=_headers("FHKST01010100"), params=params, timeout=10)
    r.raise_for_status()
    d = r.json().get("output", {})
    return {
        "현재가":   int(d.get("stck_prpr", 0)),
        "등락률":   float(d.get("prdy_ctrt", 0)),
        "등락폭":   int(d.get("prdy_vrss", 0)),
        "거래량":   int(d.get("acml_vol", 0)),
        "거래대금": int(d.get("acml_tr_pbmn", 0)),
        "시가":     int(d.get("stck_oprc", 0)),
        "고가":     int(d.get("stck_hgpr", 0)),
        "저가":     int(d.get("stck_lwpr", 0)),
        "52주고":   int(d.get("d250_hgpr", 0)),
        "52주저":   int(d.get("d250_lwpr", 0)),
        "PER":      float(d.get("per", 0)),
        "PBR":      float(d.get("pbr", 0)),
    }


# ── 호가창 ────────────────────────────────────────────
def get_orderbook(ticker: str) -> dict:
    url = BASE_URL[config.KIS_MODE] + "/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn"
    params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker}
    r = requests.get(url, headers=_headers("FHKST01010200"), params=params, timeout=10)
    r.raise_for_status()
    d = r.json().get("output1", {})

    asks, bids = [], []
    for i in range(1, 6):
        asks.append({
            "가격": int(d.get(f"askp{i}", 0)),
            "잔량": int(d.get(f"askp_rsqn{i}", 0)),
        })
        bids.append({
            "가격": int(d.get(f"bidp{i}", 0)),
            "잔량": int(d.get(f"bidp_rsqn{i}", 0)),
        })
    return {"매도호가": asks, "매수호가": bids}


# ── 분봉 데이터 ───────────────────────────────────────
def get_minute_chart(ticker: str, timeunit: str = "5") -> list[dict]:
    """분봉 (timeunit: 1,3,5,10,15,30,60,120,240)"""
    url = BASE_URL[config.KIS_MODE] + "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice"
    now = datetime.now().strftime("%H%M%S")
    params = {
        "fid_etc_cls_code": "",
        "fid_cond_mrkt_div_code": "J",
        "fid_input_iscd": ticker,
        "fid_input_hour_1": now,
        "fid_pw_data_incu_yn": "Y",
        "fid_time_cls_code": timeunit,
    }
    r = requests.get(url, headers=_headers("FHKST03010200"), params=params, timeout=10)
    r.raise_for_status()
    output = r.json().get("output2", [])
    result = []
    for row in output:
        date_str = row.get("stck_bsop_date", "")
        time_str = row.get("stck_cntg_hour", "")
        raw = date_str + time_str
        try:
            dt = datetime.strptime(raw, "%Y%m%d%H%M%S")
            label = dt.strftime("%m/%d %H:%M")   # 차트 x축용 간결 포맷
        except:
            label = raw
        result.append({
            "시간":   label,
            "시가":   int(row.get("stck_oprc", 0)),
            "고가":   int(row.get("stck_hgpr", 0)),
            "저가":   int(row.get("stck_lwpr", 0)),
            "종가":   int(row.get("stck_prpr", 0)),
            "거래량": int(row.get("cntg_vol", 0)),
        })
    return list(reversed(result))   # 시간 오름차순


# ── 일봉/주봉/월봉/년봉 — pykrx 사용 ─────────────────
def get_period_chart(ticker: str, period: str = "D") -> list[dict]:
    """
    period: D=일봉, W=주봉, M=월봉, Y=년봉
    pykrx로 데이터를 가져와 period에 따라 리샘플링
    """
    import pandas as pd
    from pykrx import stock as krx
    from datetime import timedelta

    days_map  = {"D": 365, "W": 365 * 3, "M": 365 * 10, "Y": 365 * 30}
    fetch_days = days_map.get(period, 365)
    start = (datetime.now() - timedelta(days=fetch_days * 2)).strftime("%Y%m%d")
    end   = datetime.now().strftime("%Y%m%d")

    df = krx.get_market_ohlcv(start, end, ticker)
    df = df[df["거래량"] > 0].copy()
    df.index = pd.to_datetime(df.index)

    # 리샘플링
    rule_map = {"D": None, "W": "W-FRI", "M": "ME", "Y": "YE"}
    rule = rule_map.get(period)
    if rule:
        df = df.resample(rule).agg({
            "시가": "first", "고가": "max",
            "저가": "min",  "종가": "last",
            "거래량": "sum",
        }).dropna()

    # 표시 개수 제한
    count_map = {"D": 250, "W": 156, "M": 120, "Y": 30}
    df = df.tail(count_map.get(period, 250))

    # x축 포맷
    fmt_map = {"D": "%Y/%m/%d", "W": "%Y/%m/%d", "M": "%Y/%m", "Y": "%Y"}
    fmt = fmt_map.get(period, "%Y/%m/%d")

    result = []
    for idx, row in df.iterrows():
        result.append({
            "시간":   idx.strftime(fmt),
            "시가":   int(row["시가"]),
            "고가":   int(row["고가"]),
            "저가":   int(row["저가"]),
            "종가":   int(row["종가"]),
            "거래량": int(row["거래량"]),
        })
    return result


# ── 뉴스 ──────────────────────────────────────────────
def get_news(ticker: str) -> list[dict]:
    url = BASE_URL[config.KIS_MODE] + "/uapi/domestic-stock/v1/quotations/news-title"
    params = {"fid_input_iscd": ticker, "fid_cond_mrkt_div_code": "J"}
    try:
        r = requests.get(url, headers=_headers("FHKST11010000"), params=params, timeout=10)
        r.raise_for_status()
        items = r.json().get("output", [])
        return [{"제목": i.get("news_ttl", ""), "시간": i.get("news_regdate", ""),
                 "출처": i.get("news_src", "")} for i in items[:20]]
    except:
        return []


# ── WebSocket 실시간 체결 ──────────────────────────────
class RealtimeStream:
    """
    사용법:
        stream = RealtimeStream()
        stream.subscribe("005930", on_tick=lambda d: print(d))
        stream.start()
    """
    def __init__(self):
        self._ws = None
        self._subscriptions = {}
        self._running = False
        self._approval_key = self._get_approval_key()

    def _get_approval_key(self) -> str:
        url = BASE_URL[config.KIS_MODE] + "/oauth2/Approval"
        body = {"grant_type": "client_credentials",
                "appkey": config.KIS_APP_KEY,
                "secretkey": config.KIS_APP_SECRET}
        r = requests.post(url, json=body, timeout=10)
        return r.json().get("approval_key", "")

    def subscribe(self, ticker: str, on_tick=None):
        self._subscriptions[ticker] = on_tick

    def _on_message(self, ws, message):
        if message.startswith("0|H0STCNT0|"):
            parts = message.split("|")
            if len(parts) >= 4:
                fields = parts[3].split("^")
                ticker = fields[0] if fields else ""
                cb = self._subscriptions.get(ticker)
                if cb and len(fields) >= 13:
                    cb({
                        "티커":   ticker,
                        "현재가": int(fields[2]),
                        "등락률": float(fields[5]),
                        "거래량": int(fields[8]),
                        "시간":   fields[1],
                    })

    def _on_open(self, ws):
        for ticker in self._subscriptions:
            msg = {
                "header": {
                    "approval_key": self._approval_key,
                    "custtype": "P",
                    "tr_type": "1",
                    "content-type": "utf-8",
                },
                "body": {
                    "input": {"tr_id": "H0STCNT0", "tr_key": ticker}
                },
            }
            ws.send(json.dumps(msg))

    def start(self, daemon: bool = True):
        self._ws = websocket.WebSocketApp(
            WS_URL[config.KIS_MODE],
            on_message=self._on_message,
            on_open=self._on_open,
        )
        t = threading.Thread(target=self._ws.run_forever)
        t.daemon = daemon
        t.start()
        self._running = True

    def stop(self):
        if self._ws:
            self._ws.close()
        self._running = False
