# JUCHEON — 한국 주식 트레이딩 대시보드

한국 주식 단기 매매를 위한 개인 트레이딩 대시보드.
KIS OpenAPI · Gemini AI · Telegram Bot을 연동한 Next.js 풀스택 앱.

## 주요 기능

- **실시간 시세 · 차트** — 캔들스틱 차트 + RSI/MACD/볼린저밴드
- **종목 스크리너** — 30개 종목 기술 지표 점수 + 외국인/기관 수급 분석
- **AI 종목 분석** — Gemini가 기술 지표 · 수급 · 뉴스를 종합 분석
- **시장 흐름** — KOSPI/KOSDAQ 지수 + 등락 분포
- **모닝 브리핑** — 매일 08:00 KST 미국 시장 분석 → 국내 관련주 발굴 (Vercel Cron)
- **급등 감지기** — 장중 15초 간격 스캔, 기준 충족 시 텔레그램 즉시 알림
- **리스크 계산기** — 포지션 사이징 / 손익비 계산
- **매매 일지** — localStorage 기반 매매 기록

## 급등 알림 기준

| 등급 | 조건 |
|------|------|
| 🔥 상한가 근접 | 28%+ |
| 🚀 급등 포착 | 15%+ & 거래대금 50억+ |
| ⚡ 장 초반 강세 | 10%+ & 거래대금 50억+ & 09:30 이전 |

## 스택

- **프레임워크** — Next.js 16 (App Router) · TypeScript
- **스타일** — Tailwind CSS v4 · shadcn/ui
- **데이터** — 한국투자증권 KIS OpenAPI (실계좌)
- **AI** — Google Gemini 2.0 Flash / 2.5 Pro (자동 폴백)
- **알림** — Telegram Bot API (채널 브로드캐스트)
- **배포** — Vercel (Cron Jobs 포함)

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run watch      # 급등 감지기 (장중 상시 실행)
npm run morning    # 모닝 브리핑 수동 테스트
```

## 환경변수 (.env.local)

```
KIS_APP_KEY=
KIS_APP_SECRET=
KIS_ACCOUNT=
KIS_ACCOUNT_SUFFIX=01
KIS_MODE=real

GOOGLE_API_KEY=

TELEGRAM_TOKEN=           # 주천 분석방 봇
TELEGRAM_CHAT_ID=         # 주천 분석방 채널 ID

TELEGRAM_ALERT_TOKEN=     # 주천 급등방 봇
TELEGRAM_ALERT_CHAT_ID=   # 주천 급등방 채널 ID

DART_API_KEY=             # 선택: DART 공시
CRON_SECRET=              # 선택: Vercel Cron 보안
```

## 텔레그램 채널

- 주천 분석방 (모닝 브리핑) — https://t.me/+XxG9M-TY1gpmY2Nl
- 주천 급등방 (급등 알림) — https://t.me/+k1G5uv5BFxg2ZGM1
