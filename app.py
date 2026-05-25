import streamlit as st

st.set_page_config(
    page_title="개인 트레이더",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

from core.styles import inject
inject(st)

# ── 면책 조항 팝업 ────────────────────────────────────
@st.dialog("서비스 이용 전 확인사항", width="large")
def show_disclaimer():
    st.markdown("""
<div style='line-height:1.8'>

<div style='font-size:1rem;font-weight:700;color:#191919;margin-bottom:.75rem'>
  📋 투자 정보 제공 서비스 이용 약관
</div>

<div style='background:#fff8f0;border-left:3px solid #f59e0b;padding:.875rem 1rem;
            border-radius:0 8px 8px 0;margin-bottom:1rem;font-size:.875rem;color:#191919'>
  본 서비스는 <b>개인 학습 및 정보 제공 목적</b>으로 제작된 도구입니다.<br>
  투자자문업 등록 서비스가 아니며, 투자 권유를 목적으로 하지 않습니다.
</div>

<div style='font-size:.9rem;color:#191919;margin-bottom:.5rem'>
아래 내용을 반드시 확인하고 동의하신 후 이용해 주세요.
</div>

<div style='display:flex;flex-direction:column;gap:.5rem;font-size:.875rem;color:#444;margin-bottom:1rem'>
  <div>① 제공되는 모든 시세·지표·분석 정보는 <b>투자 권유가 아닌 참고용 정보</b>입니다.</div>
  <div>② 투자 판단 및 그에 따른 <b>손익은 전적으로 이용자 본인</b>에게 있습니다.</div>
  <div>③ 금융투자상품 투자 시 <b>원금 손실이 발생</b>할 수 있습니다.</div>
  <div>④ 본 서비스는 <b>자본시장법상 투자자문업과 무관</b>하며, 서비스 운영자는 투자 손실에 대한 법적 책임을 지지 않습니다.</div>
  <div>⑤ 데이터 오류·지연·누락이 발생할 수 있으며, 이로 인한 <b>손해에 대해 책임지지 않습니다.</b></div>
</div>

</div>
""", unsafe_allow_html=True)

    agreed = st.checkbox("위 내용을 모두 확인하였으며, 이에 동의합니다.")
    st.markdown("<div style='height:.5rem'></div>", unsafe_allow_html=True)

    col_agree, col_cancel = st.columns(2)
    with col_agree:
        if st.button("동의하고 시작하기", type="primary",
                     use_container_width=True, disabled=not agreed):
            st.session_state.disclaimer_agreed = True
            st.rerun()
    with col_cancel:
        if st.button("동의하지 않음", use_container_width=True):
            st.session_state.disclaimer_agreed = False
            st.markdown("""
<div style='text-align:center;color:#f04452;font-size:.875rem;margin-top:.5rem'>
  동의하지 않으면 서비스를 이용할 수 없습니다.
</div>""", unsafe_allow_html=True)

if "disclaimer_agreed" not in st.session_state:
    st.session_state.disclaimer_agreed = False

if not st.session_state.disclaimer_agreed:
    show_disclaimer()
    st.stop()

# ── 네비게이션 ────────────────────────────────────────
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
