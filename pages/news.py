import streamlit as st

from core.styles import inject
inject(st)

import config
kis_ready = bool(config.KIS_APP_KEY and config.KIS_APP_SECRET)

# ── 헤더 ─────────────────────────────────────────────
st.markdown("""
<div style='margin-bottom:1.5rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>NEWS & DISCLOSURE</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>뉴스 · 공시 모니터링</div>
</div>
""", unsafe_allow_html=True)

# ── 검색 바 ───────────────────────────────────────────
sc1, sc2, sc3 = st.columns([3, 1.2, 1])
with sc1:
    query = st.text_input("", placeholder="🔍  종목명 또는 키워드  (예: 삼성전자, 반도체, 실적)",
                          label_visibility="collapsed", key="news_query")
with sc2:
    ticker_input = st.text_input("", placeholder="티커  (예: 005930)",
                                 label_visibility="collapsed", key="news_ticker")
with sc3:
    search = st.button("조회", type="primary", use_container_width=True)

if not kis_ready:
    st.caption("⚠ config.py에 KIS 키 설정 시 실시간 뉴스를 이용할 수 있습니다.")

st.markdown("<hr>", unsafe_allow_html=True)

# ── 결과 탭 ───────────────────────────────────────────
tab_kis, tab_naver = st.tabs(["📡 KIS 실시간 뉴스", "📰 네이버 금융 뉴스"])

if search:
    ticker = ticker_input.strip() or "005930"

    with tab_kis:
        if kis_ready:
            from core.kis import get_news
            with st.spinner("KIS 뉴스 조회 중..."):
                news = get_news(ticker)
            if news:
                for item in news:
                    st.markdown(f"""
<div style='border:1px solid #e2e4ea;border-radius:.5em;padding:.8rem 1rem;
            margin-bottom:.5rem;background:#f8f9fc'>
  <span style='font-size:.7rem;color:#1a1a2e40;font-family:"Space Mono",monospace'>
    {item['시간']}
  </span>
  &nbsp;
  <span style='font-size:.9rem;font-weight:500;color:#1a1a2e'>{item['제목']}</span>
  <span style='font-size:.75rem;color:#1a1a2e60;margin-left:.5rem'>— {item['출처']}</span>
</div>""", unsafe_allow_html=True)
            else:
                st.info("뉴스가 없습니다.")
        else:
            st.warning("config.py에 KIS_APP_KEY / KIS_APP_SECRET를 입력하세요.")

    with tab_naver:
        if query.strip():
            from core.news import get_naver_news
            with st.spinner("네이버 뉴스 조회 중..."):
                news = get_naver_news(query)
            if news:
                for item in news:
                    st.markdown(f"""
<div style='border:1px solid #e2e4ea;border-radius:.5em;padding:.8rem 1rem;
            margin-bottom:.5rem;background:#f8f9fc'>
  <a href='{item["링크"]}' target='_blank'
     style='font-size:.9rem;font-weight:500;color:#0f6fff;text-decoration:none'>
    {item['제목']}
  </a>
</div>""", unsafe_allow_html=True)
            else:
                st.info("결과 없음")
        else:
            st.info("종목명 또는 키워드를 입력 후 조회하세요.")

else:
    with tab_kis:
        st.markdown("""
<div style='text-align:center;padding:60px 0'>
  <div style='font-size:2.5rem;margin-bottom:1rem'>📡</div>
  <div style='font-size:.95rem;color:#1a1a2e60'>티커를 입력하고 조회하면 KIS 실시간 뉴스를 가져옵니다</div>
</div>""", unsafe_allow_html=True)
    with tab_naver:
        st.markdown("""
<div style='text-align:center;padding:60px 0'>
  <div style='font-size:2.5rem;margin-bottom:1rem'>📰</div>
  <div style='font-size:.95rem;color:#1a1a2e60'>키워드를 입력하고 조회하면 네이버 금융 뉴스를 가져옵니다</div>
</div>""", unsafe_allow_html=True)
