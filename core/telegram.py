import requests
import config

APP_URL = "https://jucheon.streamlit.app/"

def send(message: str) -> bool:
    if not config.TELEGRAM_TOKEN or not config.TELEGRAM_CHAT_ID:
        return False
    url = f"https://api.telegram.org/bot{config.TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": config.TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        r = requests.post(url, json=payload, timeout=10)
        return r.json().get("ok", False)
    except:
        return False

def alert_stock(stock: dict):
    """스크리너 발굴 종목 알림"""
    ret = stock.get("등락률", 0)
    ret_str = f"+{ret}%" if ret >= 0 else f"{ret}%"
    msg = (
        f"📈 <b>[매매신호] {stock['종목명']} ({stock['티커']})</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"전략: {stock['전략']}\n"
        f"현재가: {stock['현재가']:,}원  ({ret_str})\n"
        f"거래량: {stock['거래량비율']}배  RSI: {stock['RSI']}\n"
        f"신호점수: {stock['점수']}/100\n"
        f"━━━━━━━━━━━━━━━\n"
        f"✅ <a href='{APP_URL}'>대시보드에서 확인</a> 후 직접 주문하세요"
    )
    return send(msg)

def alert_market_open(kospi: float, kosdaq: float, regime: str):
    msg = (
        f"🌅 <b>장 시작 브리핑</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"코스피: {kospi:,.0f}  |  코스닥: {kosdaq:,.0f}\n"
        f"시장 국면: {regime}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"스크리닝을 시작합니다\n"
        f"🔗 <a href='{APP_URL}'>대시보드 열기</a>"
    )
    return send(msg)

def alert_market_close(found: int, total_checked: int):
    msg = (
        f"🌆 <b>장 마감 요약</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"오늘 스캔: {total_checked}종목\n"
        f"신호 발생: {found}건\n"
        f"수고하셨습니다 🙌\n"
        f"🔗 <a href='{APP_URL}'>대시보드 열기</a>"
    )
    return send(msg)

def test_message() -> bool:
    return send("✅ 개인 트레이더 알림 연결 성공!\n텔레그램 알림이 정상 작동합니다.")
