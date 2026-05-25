import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

from core.styles import inject
inject(st)

# ── 헤더 ─────────────────────────────────────────────
st.markdown("""
<div style='margin-bottom:1.5rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>TECHNICAL ANALYSIS</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>종목 분석</div>
</div>
""", unsafe_allow_html=True)

# ── session_state 초기화 ──────────────────────────────
if "an_ticker" not in st.session_state:
    st.session_state.an_ticker = None
    st.session_state.an_name   = ""
if "an_days" not in st.session_state:
    st.session_state.an_days = 120

# ── 검색 바 ───────────────────────────────────────────
search_col, _ = st.columns([3, 2])
with search_col:
    query = st.text_input("", placeholder="🔍  종목명 검색  (예: 삼성전자, SK하이닉스, 카카오)",
                          label_visibility="collapsed", key="an_query")

if query:
    from core.data import search_ticker
    results = search_ticker(query)
    if results:
        opts  = {n: t for t, n in results}
        sel_col, _ = st.columns([3, 2])
        with sel_col:
            sel = st.selectbox("", list(opts.keys()),
                               label_visibility="collapsed", key="an_sel")
        st.session_state.an_ticker = opts[sel]
        st.session_state.an_name   = sel
    else:
        st.warning("검색 결과 없음")

ticker     = st.session_state.an_ticker
stock_name = st.session_state.an_name

if not ticker:
    st.markdown("""
<div style='text-align:center;padding:80px 0'>
  <div style='font-size:3rem;margin-bottom:1rem'>📊</div>
  <div style='font-size:1rem;color:#1a1a2e60'>
    종목을 검색하면 기술지표 · 차트 분석 결과를 바로 확인합니다
  </div>
  <div style='font-size:.85rem;color:#1a1a2e40;margin-top:.5rem'>
    일부만 입력해도 검색됩니다 &nbsp;·&nbsp; 예: 삼성, 하이닉스, 카카오
  </div>
</div>""", unsafe_allow_html=True)
    st.stop()

st.markdown("<hr>", unsafe_allow_html=True)

# ── 기간 버튼 ─────────────────────────────────────────
b1, b2, b3, *_ = st.columns([1, 1, 1, 4])
for label, val, col in [("60일", 60, b1), ("120일", 120, b2), ("250일", 250, b3)]:
    if col.button(label, use_container_width=True,
                  type="primary" if st.session_state.an_days == val else "secondary"):
        st.session_state.an_days = val
        st.rerun()
days = st.session_state.an_days

# ── 데이터 로딩 ───────────────────────────────────────
from core.data import get_ohlcv, get_ticker_name
from core.indicators import add_indicators, signal_summary

with st.spinner("분석 중..."):
    df = get_ohlcv(ticker, days=days)

if df.empty:
    st.error("데이터를 불러올 수 없습니다.")
    st.stop()

df     = add_indicators(df)
signals = signal_summary(df)
last   = df.iloc[-1]

# ── 지표 카드 ─────────────────────────────────────────
st.markdown(f"### {stock_name} ({ticker})")

m1, m2, m3, m4, m5 = st.columns(5)
import math
ret_1d = float(last["ret_1d"]) if not math.isnan(float(last["ret_1d"])) else 0.0
m1.metric("현재가",  f"{int(last['종가']):,}원",
          f"{ret_1d:+.2f}%",
          delta_color="normal" if ret_1d >= 0 else "inverse")
m2.metric("RSI",     signals["RSI"])
m3.metric("MACD",    signals["MACD"])
m4.metric("거래량",  signals["거래량"])
score = signals["종합점수"]
m5.metric("종합점수", f"{score}/100",
          "매수 우호" if score >= 65 else "중립" if score >= 45 else "주의")

# ── 차트 ──────────────────────────────────────────────
fig = make_subplots(
    rows=3, cols=1, shared_xaxes=True,
    row_heights=[0.55, 0.2, 0.25],
    vertical_spacing=0.03,
    subplot_titles=["가격 · 이동평균 · 볼린저밴드", "거래량", "RSI / MACD"]
)

fig.add_trace(go.Candlestick(
    x=df.index, open=df["시가"], high=df["고가"],
    low=df["저가"], close=df["종가"],
    name="주가",
    increasing_line_color="#ef5350", decreasing_line_color="#1976d2",
    increasing_fillcolor="#ef5350",  decreasing_fillcolor="#1976d2",
    hovertemplate=(
        "<b>%{x|%Y-%m-%d}</b><br>"
        "시가: %{open:,.0f}원<br>"
        "고가: %{high:,.0f}원<br>"
        "저가: %{low:,.0f}원<br>"
        "종가: %{close:,.0f}원"
        "<extra></extra>"
    ),
), row=1, col=1)

for ma, color in {"MA5":"#ff9800","MA20":"#4caf50","MA60":"#9c27b0","MA120":"#607d8b"}.items():
    if ma in df.columns:
        fig.add_trace(go.Scatter(
            x=df.index, y=df[ma], name=ma,
            line=dict(color=color, width=1.2),
            hovertemplate=f"{ma}: %{{y:,.0f}}원<extra></extra>",
        ), row=1, col=1)

fig.add_trace(go.Scatter(
    x=df.index, y=df["BB_upper"], name="BB상단",
    line=dict(color="#aaa", width=1, dash="dot"),
    hovertemplate="BB상단: %{y:,.0f}원<extra></extra>",
    showlegend=False,
), row=1, col=1)
fig.add_trace(go.Scatter(
    x=df.index, y=df["BB_lower"], name="BB하단",
    line=dict(color="#aaa", width=1, dash="dot"),
    fill="tonexty", fillcolor="rgba(150,150,150,0.07)",
    hovertemplate="BB하단: %{y:,.0f}원<extra></extra>",
    showlegend=False,
), row=1, col=1)

vol_colors = ["#ef5350" if r >= 0 else "#1976d2" for r in df["ret_1d"]]
fig.add_trace(go.Bar(
    x=df.index, y=df["거래량"], marker_color=vol_colors,
    showlegend=False,
    hovertemplate="거래량: %{y:,.0f}<extra></extra>",
), row=2, col=1)
fig.add_trace(go.Scatter(
    x=df.index, y=df["VMA20"],
    line=dict(color="orange", width=1.5),
    showlegend=False,
    hovertemplate="거래량MA20: %{y:,.0f}<extra></extra>",
), row=2, col=1)

fig.add_trace(go.Scatter(
    x=df.index, y=df["RSI"], name="RSI",
    line=dict(color="#e91e63", width=1.5),
    hovertemplate="RSI: %{y:.1f}<extra></extra>",
), row=3, col=1)
for level, color in [(70, "rgba(220,50,50,0.25)"), (30, "rgba(50,50,220,0.25)")]:
    fig.add_hline(y=level, line_dash="dash", line_color=color, row=3, col=1)

macd_colors = ["#ef5350" if v >= 0 else "#1976d2" for v in df["MACD_hist"]]
fig.add_trace(go.Bar(
    x=df.index, y=df["MACD_hist"], name="MACD",
    marker_color=macd_colors, opacity=0.6,
    hovertemplate="MACD: %{y:.4f}<extra></extra>",
), row=3, col=1)

fig.update_layout(
    height=750, xaxis_rangeslider_visible=False,
    legend=dict(orientation="h", y=1.02),
    plot_bgcolor="#fafafa", paper_bgcolor="#ffffff",
    font=dict(color="#191919", size=11,
              family="Pretendard Variable, sans-serif"),
    margin=dict(l=10, r=10, t=30, b=10),
    hovermode="x unified",
)
fig.update_xaxes(gridcolor="#ebebeb", tickangle=-30)
fig.update_yaxes(gridcolor="#ebebeb")
st.plotly_chart(fig, use_container_width=True,
                key=f"chart_{ticker}_{days}")

# ── 신호 요약 ─────────────────────────────────────────
st.markdown("<hr>", unsafe_allow_html=True)
c1, c2, c3, c4 = st.columns(4)
c1.info(f"**추세**: {signals['추세']}")
c2.info(f"**RSI**: {signals['RSI']}\n\n**볼린저**: {signals['볼린저']}")
c3.info(f"**MACD**: {signals['MACD']}")
c4.info(f"**거래량**: {signals['거래량']}\n\n**5일수익률**: {last['ret_5d']:.2f}%")

# ── 주요 레벨 ─────────────────────────────────────────
st.markdown("<hr>", unsafe_allow_html=True)
l1, l2, l3, l4 = st.columns(4)
def _fmt(v):
    import math
    return f"{int(v):,}" if v and not math.isnan(float(v)) else "—"

l1.metric("5일선",   _fmt(last.get("MA5")))
l2.metric("20일선",  _fmt(last.get("MA20")))
l3.metric("60일선",  _fmt(last.get("MA60")))
l4.metric("ATR(14)", _fmt(last.get("ATR")))

# ── AI 분석 ───────────────────────────────────────────
st.markdown("<hr>", unsafe_allow_html=True)
st.markdown("""
<div style='margin-bottom:.75rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>AI ANALYSIS</div>
  <div style='font-size:1.125rem;font-weight:700;color:#191919'>🤖 Gemini AI 종목 분석</div>
</div>""", unsafe_allow_html=True)

ai_key = f"ai_{ticker}_{days}"
if ai_key not in st.session_state:
    st.session_state[ai_key] = None

col_btn, col_info, _ = st.columns([2, 3, 2])
col_btn.button("AI 분석 요청", type="primary", use_container_width=True,
               key="ai_request_btn")
col_info.caption("RSI · MACD · 볼린저밴드 · 거래량 등 지표를 종합해 자연어로 해석합니다")

if st.session_state.get("ai_request_btn"):
    with st.spinner("Gemini가 분석 중입니다... (5~10초 소요)"):
        try:
            from core.ai import analyze
            st.session_state[ai_key] = analyze(stock_name, ticker, df)
        except Exception as e:
            st.session_state[ai_key] = f"오류: {e}"

if st.session_state[ai_key]:
    result_text = st.session_state[ai_key]
    if result_text.startswith("⏳"):
        st.warning(result_text)
    elif result_text.startswith("❌") or result_text.startswith("오류"):
        st.error(result_text)
    else:
        st.markdown(result_text)
