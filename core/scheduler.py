"""
장 시간 중 주기적으로 스크리닝 실행 → 신호 발생 시 텔레그램 알림
- 장 시작(09:05): 시장 브리핑
- 09:10 ~ 15:20: 매 N분마다 스크리닝
- 장 마감(15:30): 요약 알림
- 중복 알림 방지: 당일 이미 알린 종목은 다시 보내지 않음
"""
import time
import threading
from datetime import datetime, date
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

_alerted_today: dict[str, date] = {}  # ticker → 마지막 알림 날짜
_stats = {"checked": 0, "found": 0}
_running = False
_thread = None

def _is_market_hour() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:          # 주말
        return False
    t = now.hour * 100 + now.minute
    return 910 <= t <= 1520

def _run_loop(interval_min: int, market: str, max_stocks: int):
    global _running, _stats

    from core.screener import run_screener
    from core.data import get_market_index, get_kosdaq_index
    from core.indicators import add_indicators
    from core.telegram import alert_stock, alert_market_open, alert_market_close

    today_date = date.today()
    opened = False
    closed = False
    _stats = {"checked": 0, "found": 0}

    while _running:
        now = datetime.now()
        t = now.hour * 100 + now.minute

        # 장 시작 브리핑 (09:05 한번)
        if t == 905 and not opened:
            try:
                kospi = get_market_index(5)
                kosdaq = get_kosdaq_index(5)
                kp = float(kospi.iloc[-1]["종가"])
                kd = float(kosdaq.iloc[-1]["종가"])
                kospi_ind = add_indicators(kospi)
                regime = "상승추세" if float(kospi_ind.iloc[-1]["종가"]) > float(kospi_ind.iloc[-1]["MA20"]) else "주의"
                alert_market_open(kp, kd, regime)
            except:
                pass
            opened = True

        # 장 마감 요약 (15:30 한번)
        if t == 1530 and not closed:
            alert_market_close(_stats["found"], _stats["checked"])
            closed = True

        # 스크리닝 실행
        if _is_market_hour():
            try:
                df = run_screener(market=market, max_stocks=max_stocks)
                _stats["checked"] += max_stocks

                for _, row in df.iterrows():
                    ticker = row["티커"]
                    # 당일 이미 알림 발송한 종목 스킵
                    if _alerted_today.get(ticker) == today_date:
                        continue
                    if row["점수"] >= 65:
                        alert_stock(row.to_dict())
                        _alerted_today[ticker] = today_date
                        _stats["found"] += 1
                        time.sleep(1)  # 연속 전송 간격
            except Exception as e:
                print(f"[scheduler] 스크리닝 오류: {e}")

        # 다음 실행까지 대기
        time.sleep(interval_min * 60)


def start(interval_min: int = 30, market: str = "ALL", max_stocks: int = 150):
    global _running, _thread
    if _running:
        return "이미 실행 중입니다"
    _running = True
    _thread = threading.Thread(
        target=_run_loop,
        args=(interval_min, market, max_stocks),
        daemon=True
    )
    _thread.start()
    return f"스케줄러 시작 ({interval_min}분 간격, {market})"

def stop():
    global _running
    _running = False
    return "스케줄러 정지"

def is_running() -> bool:
    return _running

def get_stats() -> dict:
    return _stats.copy()
