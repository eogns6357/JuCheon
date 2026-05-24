# config.py 템플릿 — 복사 후 config.py로 이름 변경하고 값을 채우세요

# 한국투자증권 API (시세 조회용)
# https://apiportal.koreainvestment.com 에서 발급
KIS_APP_KEY    = ""
KIS_APP_SECRET = ""
KIS_ACCOUNT    = ""        # 계좌번호 앞 8자리
KIS_ACCOUNT_SUFFIX = "01"
KIS_MODE       = "real"    # "real" 또는 "paper" (모의투자)

# DART 공시 API (선택)
# https://opendart.fss.or.kr 에서 발급
DART_API_KEY   = ""

# Google Gemini AI 분석 (무료)
# https://aistudio.google.com/app/apikey 에서 발급
GOOGLE_API_KEY = ""

# 텔레그램 알림
# @BotFather 에서 봇 생성 후 토큰 발급
TELEGRAM_TOKEN   = ""
TELEGRAM_CHAT_ID = ""
