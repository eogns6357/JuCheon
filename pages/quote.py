import streamlit as st
import time
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

from core.styles import inject
inject(st)

import config
if not config.KIS_APP_KEY:
    st.error("config.py에 KIS_APP_KEY를 입력하세요.")
    st.stop()

from core import realtime
from core.kis import get_price as rest_price, get_orderbook, get_minute_chart, get_period_chart

# ── session_state 초기화 ──────────────────────────────
if "period" not in st.session_state:
    st.session_state.period = "minute"
if "rt_auto" not in st.session_state:
    st.session_state.rt_auto = True

# ── WebSocket 시작 ────────────────────────────────────
realtime.start()

# ── 헤더 ─────────────────────────────────────────────
st.markdown("""
<div style='margin-bottom:1.5rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>REAL-TIME QUOTE</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>실시간 시세</div>
</div>
""", unsafe_allow_html=True)

# ── 검색 바 ───────────────────────────────────────────
from core.data import search_ticker

ticker     = None
stock_name = ""

search_col, _ = st.columns([3, 2])
with search_col:
    query = st.text_input("", placeholder="🔍  종목명 검색  (예: 삼성전자, GS건설, 하이닉스)",
                          label_visibility="collapsed")

if query:
    results = search_ticker(query)
    if results:
        opts  = {n: t for t, n in results}
        sel_col, _ = st.columns([3, 2])
        with sel_col:
            sel = st.selectbox("검색 결과", list(opts.keys()),
                               label_visibility="collapsed")
        ticker     = opts[sel]
        stock_name = sel
    else:
        st.warning("검색 결과 없음")

if not ticker:
    st.markdown("""
<div style='text-align:center;padding:80px 0'>
  <div style='font-size:3rem;margin-bottom:1rem'>📡</div>
  <div style='font-size:1rem;color:#1a1a2e60'>종목을 검색해서 실시간 시세를 확인하세요</div>
  <div style='font-size:.85rem;color:#1a1a2e40;margin-top:.5rem'>
    종목명 일부만 입력해도 검색됩니다 &nbsp;·&nbsp; 예: GS, 하이닉스, 카카오
  </div>
</div>""", unsafe_allow_html=True)
    st.stop()

# ── 구독 등록 ─────────────────────────────────────────
realtime.subscribe(ticker)

st.markdown("<hr>", unsafe_allow_html=True)

# ── 컨트롤 바 (인라인) ───────────────────────────────
ctrl_left, ctrl_mid, ctrl_right = st.columns([2, 5, 2])

with ctrl_left:
    minute_unit = st.selectbox(
        "분봉", ["1","3","5","10","15","30","60","120","240"],
        index=2, format_func=lambda x: f"{x}분",
        label_visibility="collapsed",
    )

with ctrl_mid:
    pb1, pb2, pb3, pb4, pb5 = st.columns(5)
    if pb1.button("분봉",  use_container_width=True,
                  type="primary" if st.session_state.period=="minute" else "secondary"):
        st.session_state.period = "minute"
    if pb2.button("일봉",  use_container_width=True,
                  type="primary" if st.session_state.period=="D" else "secondary"):
        st.session_state.period = "D"
    if pb3.button("주봉",  use_container_width=True,
                  type="primary" if st.session_state.period=="W" else "secondary"):
        st.session_state.period = "W"
    if pb4.button("월봉",  use_container_width=True,
                  type="primary" if st.session_state.period=="M" else "secondary"):
        st.session_state.period = "M"
    if pb5.button("년봉",  use_container_width=True,
                  type="primary" if st.session_state.period=="Y" else "secondary"):
        st.session_state.period = "Y"

with ctrl_right:
    rt1, rt2 = st.columns(2)
    auto_refresh = rt1.toggle("실시간", value=st.session_state.rt_auto)
    st.session_state.rt_auto = auto_refresh
    refresh_btn = rt2.button("🔄", use_container_width=True)

st.markdown("<hr>", unsafe_allow_html=True)

# ── 가격 데이터 ───────────────────────────────────────
ws_data = realtime.get_price(ticker)

if ws_data:
    price = ws_data
    src   = f"🟢 실시간 체결가 ({ws_data['갱신시각']})"
else:
    try:
        rest  = rest_price(ticker)
        price = rest
        src   = "🟡 REST 조회 (WebSocket 연결 중...)"
    except Exception as e:
        st.error(f"시세 오류: {e}")
        st.stop()

st.caption(src)

# ── 현재가 헤더 ───────────────────────────────────────
ret = price.get("등락률", 0)
c1, c2, c3, c4 = st.columns(4)
c1.metric(stock_name,       f"{price['현재가']:,}원",
          f"{ret:+.2f}%  ({price.get('등락폭',0):+,}원)")
c2.metric("고가 / 저가",   f"{price.get('고가',0):,} / {price.get('저가',0):,}")
c3.metric("거래량",         f"{price.get('거래량',0):,}")
c4.metric("거래대금",       f"{price.get('거래대금',0)//100_000_000:,}억")

st.markdown("<hr>", unsafe_allow_html=True)

# ── 차트 + 호가 ───────────────────────────────────────
col_chart, col_book = st.columns([2.2, 1])

with col_chart:
    period = st.session_state.period
    try:
        if period == "minute":
            candles = get_minute_chart(ticker, minute_unit)
        else:
            candles = get_period_chart(ticker, period)
    except Exception as e:
        st.error(f"차트 오류: {e}")
        candles = []

    if candles:
        df = pd.DataFrame(candles)
        df = df[df["종가"] > 0].reset_index(drop=True)
        c  = df["종가"].astype(float)
        for n in [5, 10, 20, 60, 120]:
            df[f"MA{n}"] = c.rolling(n).mean()

        fig = make_subplots(
            rows=2, cols=1, shared_xaxes=True,
            row_heights=[0.72, 0.28], vertical_spacing=0.02,
        )
        fig.add_trace(go.Candlestick(
            x=df["시간"], open=df["시가"], high=df["고가"],
            low=df["저가"], close=df["종가"],
            increasing_line_color="#ef5350", decreasing_line_color="#1976d2",
            increasing_fillcolor="#ef5350",  decreasing_fillcolor="#1976d2",
            name="주가",
            hovertemplate=(
                "<b>%{x}</b><br>"
                "시가: %{open:,.0f}원<br>"
                "고가: %{high:,.0f}원<br>"
                "저가: %{low:,.0f}원<br>"
                "종가: %{close:,.0f}원"
                "<extra></extra>"
            ),
        ), row=1, col=1)

        for n, color in {5:"#ff9800",10:"#ffeb3b",20:"#4caf50",60:"#9c27b0",120:"#607d8b"}.items():
            if df[f"MA{n}"].notna().sum() > 2:
                fig.add_trace(go.Scatter(
                    x=df["시간"], y=df[f"MA{n}"], name=f"MA{n}",
                    line=dict(color=color, width=1.2),
                    hovertemplate=f"MA{n}: %{{y:,.0f}}원<extra></extra>",
                ), row=1, col=1)

        vol_colors = ["#ef5350" if r["종가"] >= r["시가"] else "#1976d2"
                      for _, r in df.iterrows()]
        fig.add_trace(go.Bar(
            x=df["시간"], y=df["거래량"],
            marker_color=vol_colors, showlegend=False, name="거래량",
            hovertemplate="거래량: %{y:,.0f}<extra></extra>",
        ), row=2, col=1)

        fig.update_layout(
            height=560, xaxis_rangeslider_visible=False,
            plot_bgcolor="#fafafa", paper_bgcolor="#ffffff",
            font=dict(color="#191919", size=11,
                      family="Pretendard Variable, sans-serif"),
            legend=dict(orientation="h", y=1.02, x=0),
            margin=dict(l=10, r=10, t=10, b=10),
            hovermode="x unified",
        )
        fig.update_xaxes(gridcolor="#ebebeb", tickangle=-30, nticks=12)
        fig.update_yaxes(gridcolor="#ebebeb")
        fig.update_yaxes(title_text="거래량", row=2, col=1)
        st.plotly_chart(fig, use_container_width=True,
                        key=f"chart_{ticker}_{period}_{minute_unit}")
    else:
        st.info("차트 데이터 없음 (장 시간 외)")

with col_book:
    st.markdown("#### 호가창")
    try:
        book = get_orderbook(ticker)
        asks = pd.DataFrame(book.get("매도호가", [])[::-1]).rename(
            columns={"가격": "매도호가", "잔량": "매도잔량"})
        bids = pd.DataFrame(book.get("매수호가", [])).rename(
            columns={"가격": "매수호가", "잔량": "매수잔량"})
        st.dataframe(
            asks.style.applymap(lambda _: "color:#1565c0;font-weight:bold",
                                subset=["매도호가"]),
            use_container_width=True, hide_index=True, height=180)
        st.markdown(
            f"<div style='text-align:center;font-size:17px;font-weight:bold;"
            f"padding:6px 0;border-radius:.5em;"
            f"background:{'#fff0f0' if ret>=0 else '#f0f4ff'};"
            f"color:{'#c0392b' if ret>=0 else '#1565c0'}'>"
            f"▶ {price['현재가']:,}원 ({ret:+.2f}%)</div>",
            unsafe_allow_html=True)
        st.dataframe(
            bids.style.applymap(lambda _: "color:#c0392b;font-weight:bold",
                                subset=["매수호가"]),
            use_container_width=True, hide_index=True, height=180)
    except Exception as e:
        st.warning(f"호가 오류: {e}")

# ── 펀더멘털 ──────────────────────────────────────────
if not ws_data:
    st.markdown("<hr>", unsafe_allow_html=True)
    f1, f2, f3, f4 = st.columns(4)
    f1.metric("PER",      f"{price.get('PER', 0):.1f}배")
    f2.metric("PBR",      f"{price.get('PBR', 0):.2f}배")
    f3.metric("52주 고가", f"{price.get('52주고', 0):,}")
    f4.metric("52주 저가", f"{price.get('52주저', 0):,}")

# ── 자동 갱신 ─────────────────────────────────────────
if auto_refresh:
    time.sleep(1)
    st.rerun()
elif refresh_btn:
    st.rerun()
