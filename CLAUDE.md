# 개인 트레이더 — Next.js 대시보드

## 프로젝트 개요
한국 주식 단기 매매용 개인 트레이딩 대시보드. 기존 `C:\dev\Stock` (Streamlit/Python) 에서 **Vercel 배포**를 위해 Next.js/TypeScript로 전면 마이그레이션한 버전.

- **배포 대상**: Vercel
- **스택**: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui
- **데이터**: 한국투자증권 KIS OpenAPI (실계좌)
- **AI 분석**: Google Gemini 2.0 Flash
- **알림**: Telegram Bot API

---

## 실행
```bash
cd C:\dev\landing
npm run dev      # http://localhost:3000
npm run build    # 빌드 검증
```

---

## 환경변수 (.env.local)
```
KIS_APP_KEY=...
KIS_APP_SECRET=...
KIS_ACCOUNT=44621943
KIS_ACCOUNT_SUFFIX=01
KIS_MODE=real
GOOGLE_API_KEY=...
# 선택: AI 모델 폴백 (품질 높은 순, 쉼표 구분). 미설정 시 2.5-pro → 2.5-flash → 2.0-flash → 2.0-flash-lite
# GEMINI_MODEL=gemini-2.5-pro,gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite
TELEGRAM_TOKEN=...
TELEGRAM_CHAT_ID=...
# 선택: 급등 감지 전용 봇 (npm run watch). 미설정 시 주천봇으로 발송
# TELEGRAM_ALERT_TOKEN=...
# TELEGRAM_ALERT_CHAT_ID=...
# 선택: DART 공시 (https://opendart.fss.or.kr)
# DART_API_KEY=...
```

---

## 디렉토리 구조

```
app/
  layout.tsx              — 루트 레이아웃 (사이드바 + 면책 조항 팝업)
  page.tsx                — HOME 대시보드 (지수 + 상위 시그널 + 바로가기)
  globals.css             — Pretendard 폰트 + 디자인 토큰 (#f0f0f5 배경, #3182f6 primary)

  quote/page.tsx          — 실시간 시세 (캔들차트 + 주요 지표)
  screener/page.tsx       — 종목 스크리너 (30개 종목 점수 테이블)
  analysis/page.tsx       — AI 종목 분석 (Gemini + 기술 지표 요약)
  market/page.tsx         — 시장 흐름 (KOSPI/KOSDAQ + 등락 분포)
  risk/page.tsx           — 리스크 계산기 (포지션 사이징)
  journal/page.tsx        — 매매 일지 (localStorage 저장)
  news/page.tsx           — /quote 리다이렉트
  alerts/page.tsx         — 알림 설정 (Telegram QR 코드)

  api/
    kis/price/route.ts    — 현재가 조회 (tr_id: FHKST01010100)
    kis/chart/route.ts    — 일봉 OHLCV 조회 (tr_id: FHKST03010100)
    kis/indices/route.ts  — KOSPI/KOSDAQ 지수 (tr_id: FHPUP02100000)
    screener/route.ts     — 30개 종목 지표 계산 후 점수 정렬
    ai/route.ts           — Gemini 기술분석 (POST { ticker, name })
    telegram/route.ts     — 알림 발송 (POST) / 설정 확인 (GET)
    news/route.ts         — 종목별 뉴스(네이버 금융) + 공시(DART, DART_API_KEY)

components/
  layout/sidebar.tsx      — 사이드바 (데스크톱 고정 + 모바일 드로어)
  disclaimer-modal.tsx    — 면책 조항 팝업 (sessionStorage, 세션당 1회)
  ui/candlestick-chart.tsx — lightweight-charts v5 캔들스틱 + 거래량

lib/
  kis.ts                  — KIS API 토큰 캐싱 + kisGet() 헬퍼
  indicators.ts           — RSI/MACD/BB/SMA/ATR (technicalindicators 패키지)
  stocks.ts               — 인기 30개 종목 목록 + 날짜/포맷 유틸
  utils.ts                — cn() (tailwind-merge)
```

---

## 디자인 시스템
- **배경**: `#f0f0f5` (페이지), `#ffffff` (카드)
- **Primary**: `#3182f6` (파란색)
- **상승**: `#f04452` (빨강 — 한국 시장 컨벤션)
- **하락**: `#2979ff` (파란색)
- **폰트**: Pretendard (jsdelivr CDN)
- **카드**: `rounded-2xl shadow-sm`, 테두리 없음
- 클래스 `.positive` / `.negative` / `.neutral` / `.num` 전역 정의됨

---

## KIS API 주요 사항
- 토큰은 `lib/kis.ts`에서 23시간 메모리 캐시
- `KIS_MODE=real` → `openapi.koreainvestment.com:9443`
- 모든 KIS 호출은 서버사이드(API Route)에서만 실행
- 스크리너는 30개 종목 × 200일 데이터 → 약 20-30초 소요
- `next: { revalidate: 30 }` 으로 30초 캐시

---

## 이전 Streamlit 버전
- 위치: `C:\dev\Stock`
- 실행: `streamlit run app.py`
- 배포: https://jucheon.streamlit.app/

---

## 관련 대화 이력
- `C:\Users\clear\.claude\projects\C--dev-Stock\` — 메인 프로젝트에서 나눈 대화들
- `C:\Users\clear\.claude\projects\C--dev-Stock\a4feb9a9-0d86-4e14-a2cb-cf6ddcf81421.jsonl` — 전체 대화 로그
- `C:\Users\clear\.claude\projects\C--dev-landing\memory\` — 이 프로젝트 메모리
