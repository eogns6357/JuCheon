"""
Google Gemini Flash 기반 종목 AI 분석
"""
import requests
import config

MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
]
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _build_prompt(name: str, ticker: str, last, prev) -> str:
    close   = float(last.get("종가", 0))
    ma5     = float(last.get("MA5",  0))
    ma20    = float(last.get("MA20", 0))
    ma60    = float(last.get("MA60", 0))
    rsi     = float(last.get("RSI",  50))
    macd    = float(last.get("MACD", 0))
    macd_s  = float(last.get("MACD_signal", 0))
    macd_h  = float(last.get("MACD_hist", 0))
    macd_hp = float(prev.get("MACD_hist", 0))
    bb_pct  = float(last.get("BB_pct", 0.5))
    vol_r   = float(last.get("vol_ratio", 1))
    ret1    = float(last.get("ret_1d",  0))
    ret5    = float(last.get("ret_5d",  0))
    atr     = float(last.get("ATR",     0))

    above = lambda x: "위" if close > x else "아래"

    return f"""한국 주식 {name}({ticker}) 기술적 분석 전문가로서 아래 데이터를 분석해주세요.

[지표]
현재가:{close:,.0f} | 1일:{ret1:+.1f}% | 5일:{ret5:+.1f}%
MA5:{ma5:,.0f}({above(ma5)}) MA20:{ma20:,.0f}({above(ma20)}) MA60:{ma60:,.0f}({above(ma60)})
RSI:{rsi:.1f} | MACD:{macd:.3f}/시그널:{macd_s:.3f}/히스토:{macd_h:.3f}({'증가' if macd_h > macd_hp else '감소'})
BB위치:{bb_pct*100:.0f}% | 거래량:{vol_r:.1f}배 | ATR:{atr:,.0f}

다음 형식으로 간결하게 분석해주세요:

### 📊 현재 국면
(2문장 이내)

### 🎯 핵심 신호
- 긍정: (1~2개)
- 부정: (1~2개)

### 📈 단기 시나리오
- 상승: (조건과 목표)
- 하락: (조건과 주의선)

### 💡 매매 체크포인트
(2~3개 bullet)"""


def analyze(name: str, ticker: str, df) -> str:
    if not config.GOOGLE_API_KEY:
        return "❌ GOOGLE_API_KEY가 config.py에 설정되지 않았습니다."

    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) >= 2 else last
    prompt = _build_prompt(name, ticker, last, prev)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }

    last_error = ""
    for model in MODELS:
        try:
            resp = requests.post(
                BASE_URL.format(model=model),
                params={"key": config.GOOGLE_API_KEY},
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            elif resp.status_code == 429:
                last_error = "rate_limit"
                continue
            elif resp.status_code == 403:
                return "❌ API 키가 유효하지 않습니다. GOOGLE_API_KEY를 확인해주세요."
            else:
                last_error = f"{resp.status_code}"
                continue
        except requests.exceptions.Timeout:
            last_error = "timeout"
            continue
        except Exception as e:
            last_error = str(e)
            continue

    if last_error == "rate_limit":
        return "⏳ 무료 요청 한도 초과 — 1분 후 다시 시도해주세요.\n\n(무료 한도: 분당 15회 / 1일 1,500회)"
    return f"❌ 분석 실패: {last_error}"
