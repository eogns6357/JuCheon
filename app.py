import streamlit as st

st.set_page_config(
    page_title="개인 트레이더",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

from core.styles import inject
inject(st)

pg = st.navigation(
    {
        "": [
            st.Page("pages/home.py", title="HOME", icon="🏠", default=True),
        ],
        "시세 · 분석": [
            st.Page("pages/quote.py",    title="실시간 시세",   icon="📡"),
            st.Page("pages/screener.py", title="종목 스크리너", icon="🔍"),
            st.Page("pages/analysis.py", title="종목 분석",     icon="📊"),
            st.Page("pages/market.py",   title="시장 흐름",     icon="🌊"),
        ],
        "매매 관리": [
            st.Page("pages/risk_calc.py", title="리스크 계산기", icon="💰"),
            st.Page("pages/journal.py",   title="매매 일지",     icon="📓"),
            st.Page("pages/news.py",      title="뉴스 · 공시",   icon="📰"),
            st.Page("pages/alerts.py",    title="알림 설정",     icon="🔔"),
        ],
    }
)

pg.run()
