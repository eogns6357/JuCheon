# 개인 트레이더

한국 주식 단기 매매를 위한 개인용 분석 대시보드

**🚀 [https://jucheon.streamlit.app](https://jucheon.streamlit.app)**

<br>

## 주요 기능

| 페이지 | 기능 |
|--------|------|
| 📡 실시간 시세 | 현재가 · 호가창 · 분봉/일봉 차트 |
| 🔍 종목 스크리너 | 거래량 돌파 · 골든크로스 · 눌림목 반등 자동 발굴 |
| 📊 종목 분석 | 기술지표(RSI · MACD · 볼린저밴드) · AI 종합 분석 |
| 🌊 시장 흐름 | 코스피 · 코스닥 국면 판단 및 매매 가이드 |
| 💰 리스크 계산기 | 포지션 크기 · 손절가 · 목표가 계산 |
| 📓 매매 일지 | 매매 기록 · 승률 · 손익비 통계 |
| 📰 뉴스 · 공시 | 종목별 최신 뉴스 조회 |
| 🔔 알림 설정 | 텔레그램 자동 알림 · 스케줄러 |

<br>

## 기술 스택

- **Frontend / Backend** — Python, Streamlit
- **시세 데이터** — 한국투자증권 KIS API, FinanceDataReader
- **AI 분석** — Google Gemini API
- **알림** — Telegram Bot API
- **차트** — Plotly

<br>

## 시작하기

### 1. 패키지 설치

```bash
pip install -r requirements.txt
```

### 2. 환경변수 설정

```bash
cp config.example.py config.py
```

`config.py`를 열어 API 키를 입력한다.

```python
KIS_APP_KEY    = "발급받은 키"
KIS_APP_SECRET = "발급받은 시크릿"
KIS_ACCOUNT    = "계좌번호 앞 8자리"
GOOGLE_API_KEY = "Gemini API 키"
TELEGRAM_TOKEN = "텔레그램 봇 토큰"
```

### 3. 실행

```bash
streamlit run app.py
```

브라우저에서 `http://localhost:8501` 접속

<br>

## API 발급

| API | 발급처 | 용도 |
|-----|--------|------|
| KIS API | [apiportal.koreainvestment.com](https://apiportal.koreainvestment.com) | 실시간 시세 · 차트 |
| Gemini API | [aistudio.google.com](https://aistudio.google.com/app/apikey) | AI 종목 분석 (무료) |
| Telegram Bot | 텔레그램 @BotFather | 매매 신호 알림 |

<br>

## 매매 흐름

```
시장 흐름 확인 → 스크리너 → 종목 분석 → 리스크 계산 → 직접 주문 → 일지 기록
```

<br>

> 이 프로그램은 개인 학습 및 분석 목적으로 제작되었습니다.
> 투자 판단과 그에 따른 손익은 본인에게 있습니다.
