"""
KIS WebSocket 실시간 체결가 수신
- 싱글턴 연결: 앱 전체에서 하나의 WS 연결 공유
- 구독 종목 추가/제거 가능
- 체결될 때마다 _price_cache 즉시 갱신
"""
import websocket
import threading
import json
import time
import requests
from datetime import datetime
import config

WS_URL = {
    "real":    "ws://ops.koreainvestment.com:21000",
    "virtual": "ws://ops.koreainvestment.com:31000",
}

_price_cache: dict[str, dict] = {}   # {ticker: price_dict}
_ws: websocket.WebSocketApp | None = None
_ws_thread: threading.Thread | None = None
_approval_key: str = ""
_subscribed: set[str] = set()
_connected = False
_lock = threading.Lock()


def get_price(ticker: str) -> dict | None:
    """캐시에서 실시간 가격 반환"""
    with _lock:
        return _price_cache.get(ticker)


def is_connected() -> bool:
    return _connected


def _get_approval_key() -> str:
    global _approval_key
    if _approval_key:
        return _approval_key
    url = f"https://openapi.koreainvestment.com:9443/oauth2/Approval"
    body = {
        "grant_type": "client_credentials",
        "appkey": config.KIS_APP_KEY,
        "secretkey": config.KIS_APP_SECRET,
    }
    r = requests.post(url, json=body, timeout=10)
    _approval_key = r.json().get("approval_key", "")
    return _approval_key


def _subscribe_msg(ticker: str) -> str:
    return json.dumps({
        "header": {
            "approval_key": _get_approval_key(),
            "custtype": "P",
            "tr_type": "1",
            "content-type": "utf-8",
        },
        "body": {"input": {"tr_id": "H0STCNT0", "tr_key": ticker}},
    })


def _unsubscribe_msg(ticker: str) -> str:
    return json.dumps({
        "header": {
            "approval_key": _get_approval_key(),
            "custtype": "P",
            "tr_type": "2",   # 2 = 해제
            "content-type": "utf-8",
        },
        "body": {"input": {"tr_id": "H0STCNT0", "tr_key": ticker}},
    })


def _parse_tick(data: str, ticker: str):
    """
    H0STCNT0 체결 데이터 파싱
    ^로 구분된 필드: 0=티커, 1=시간, 2=현재가, 3=부호, 4=전일대비, 5=등락률,
                    7=시가, 8=고가, 9=저가, 12=체결량, 13=누적거래량, 14=누적거래대금
    """
    fields = data.split("^")
    if len(fields) < 15:
        return
    sign = fields[3]   # 1=상한, 2=상승, 3=보합, 4=하한, 5=하락
    price = int(fields[2])
    change = int(fields[4])
    if sign in ("4", "5"):
        change = -change
    try:
        rate = float(fields[5])
        if sign in ("4", "5"):
            rate = -abs(rate)
    except:
        rate = 0.0

    with _lock:
        _price_cache[ticker] = {
            "현재가":   price,
            "등락폭":   change,
            "등락률":   rate,
            "시가":     int(fields[7]),
            "고가":     int(fields[8]),
            "저가":     int(fields[9]),
            "체결량":   int(fields[12]),
            "거래량":   int(fields[13]),
            "거래대금": int(fields[14]),
            "시간":     fields[1],
            "갱신시각": datetime.now().strftime("%H:%M:%S"),
        }


def _on_message(ws, message: str):
    if not message.startswith("0|"):
        return
    parts = message.split("|", 3)
    if len(parts) < 4:
        return
    tr_id = parts[1]
    count  = int(parts[2]) if parts[2].isdigit() else 1
    raw    = parts[3]

    if tr_id == "H0STCNT0":
        # 복수 체결 데이터가 한 번에 올 수 있음
        chunk = len(raw.split("^")) // count if count > 1 else len(raw.split("^"))
        all_fields = raw.split("^")
        for i in range(count):
            segment = "^".join(all_fields[i * chunk: (i + 1) * chunk])
            ticker_in = all_fields[i * chunk] if all_fields else ""
            if ticker_in:
                _parse_tick(segment, ticker_in)


def _on_open(ws):
    global _connected
    _connected = True
    with _lock:
        tickers = list(_subscribed)
    for t in tickers:
        ws.send(_subscribe_msg(t))


def _on_close(ws, code, msg):
    global _connected
    _connected = False


def _on_error(ws, error):
    global _connected
    _connected = False


def _run_ws():
    global _ws
    while True:
        try:
            _ws = websocket.WebSocketApp(
                WS_URL[config.KIS_MODE],
                on_open=_on_open,
                on_message=_on_message,
                on_close=_on_close,
                on_error=_on_error,
            )
            _ws.run_forever(ping_interval=30, ping_timeout=10)
        except Exception:
            pass
        time.sleep(5)   # 끊기면 5초 후 재연결


def start():
    """WebSocket 백그라운드 스레드 시작 (최초 1회만)"""
    global _ws_thread
    if _ws_thread and _ws_thread.is_alive():
        return
    _ws_thread = threading.Thread(target=_run_ws, daemon=True)
    _ws_thread.start()


def subscribe(ticker: str):
    """종목 실시간 구독 추가"""
    with _lock:
        if ticker in _subscribed:
            return
        _subscribed.add(ticker)
    if _ws and _connected:
        _ws.send(_subscribe_msg(ticker))


def unsubscribe(ticker: str):
    """종목 구독 해제"""
    with _lock:
        _subscribed.discard(ticker)
    if _ws and _connected:
        _ws.send(_unsubscribe_msg(ticker))
