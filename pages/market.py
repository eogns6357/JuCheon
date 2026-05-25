import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

from core.styles import inject
inject(st)

st.markdown("""
<div style='margin-bottom:1rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>MARKET OVERVIEW</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>시장 흐름</div>
  <div style='font-size:.875rem;color:#7b7b7b;margin-top:.3rem'>
    매매 전 시장 상태를 먼저 확인하세요 — 시장이 나쁘면 개별종목도 어렵습니다
  </div>
</div>
""", unsafe_allow_html=True)

with st.spinner("시장 데이터 로딩 중..."):
    from core.data import get_market_index, get_kosdaq_index
    from core.indicators import add_indicators, _rsi

    kospi = get_market_index(days=120)
    kosdaq = get_kosdaq_index(days=120)

def market_regime(df: pd.DataFrame) -> tuple[str, str]:
    """시장 국면 판단"""
    df = add_indicators(df)
    last = df.iloc[-1]
    c = float(last["종가"])
    ma20 = float(last["MA20"])
    ma60 = float(last["MA60"])
    rsi = float(last["RSI"])
    ret_5 = float(last["ret_5d"])

    if c > ma20 > ma60 and rsi > 50:
        return "상승 추세", "🟢"
    elif c < ma20 < ma60 and rsi < 50:
        return "하락 추세", "🔴"
    elif abs(ret_5) < 1.5:
        return "횡보", "🟡"
    elif ret_5 > 0:
        return "단기 반등 중", "🔵"
    else:
        return "단기 조정 중", "🟠"

k_regime, k_icon = market_regime(kospi.copy())
kd_regime, kd_icon = market_regime(kosdaq.copy())

# 상단 상태 카드
c1, c2, c3, c4 = st.columns(4)
kp_last = kospi.iloc[-1]
kp_prev = kospi.iloc[-2]
kp_ret = (float(kp_last["종가"]) - float(kp_prev["종가"])) / float(kp_prev["종가"]) * 100
c1.metric("코스피", f"{int(kp_last['종가']):,}", f"{kp_ret:+.2f}%")
c2.metric("코스피 국면", f"{k_icon} {k_regime}")

kd_last = kosdaq.iloc[-1]
kd_prev = kosdaq.iloc[-2]
kd_ret = (float(kd_last["종가"]) - float(kd_prev["종가"])) / float(kd_prev["종가"]) * 100
c3.metric("코스닥", f"{int(kd_last['종가']):,}", f"{kd_ret:+.2f}%")
c4.metric("코스닥 국면", f"{kd_icon} {kd_regime}")

# 매매 가이드
st.markdown("---")
guide_map = {
    "상승 추세": ("✅ 적극 매수 가능 — 모멘텀 전략 유효", "success"),
    "하락 추세": ("⛔ 매수 자제 — 현금 비중 높이세요", "error"),
    "횡보": ("⚠️ 선별적 매수 — 개별 재료 있는 종목만", "warning"),
    "단기 반등 중": ("🔵 눌림목 반등 기회, 단 추세 확인 필수", "info"),
    "단기 조정 중": ("🟠 신규 매수 대기, 기존 포지션 손절 관리", "warning"),
}
guide_msg, guide_type = guide_map.get(k_regime, ("중립", "info"))
getattr(st, guide_type)(f"**코스피 기준 매매 가이드**: {guide_msg}")

# 차트
st.markdown("---")
tab_kospi, tab_kosdaq = st.tabs(["코스피", "코스닥"])

def draw_index_chart(df: pd.DataFrame, title: str):
    df = add_indicators(df)
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                        row_heights=[0.7, 0.3], vertical_spacing=0.05)

    fig.add_trace(go.Scatter(
        x=df.index, y=df["종가"], name=title,
        line=dict(color="#ef5350", width=2),
        hovertemplate=f"{title}: %{{y:,.2f}}<extra></extra>",
    ), row=1, col=1)
    for ma, color in [("MA5", "#ff9800"), ("MA20", "#4caf50"), ("MA60", "#9c27b0")]:
        fig.add_trace(go.Scatter(
            x=df.index, y=df[ma], name=ma,
            line=dict(color=color, width=1.2),
            hovertemplate=f"{ma}: %{{y:,.2f}}<extra></extra>",
        ), row=1, col=1)

    vol_colors = ["#ef5350" if r >= 0 else "#1976d2" for r in df["ret_1d"]]
    fig.add_trace(go.Bar(
        x=df.index, y=df["거래량"], marker_color=vol_colors,
        showlegend=False,
        hovertemplate="거래량: %{y:,.0f}<extra></extra>",
    ), row=2, col=1)

    fig.update_layout(height=500, xaxis_rangeslider_visible=False,
                      plot_bgcolor="#fafafa", paper_bgcolor="#ffffff",
                      font=dict(color="#191919", family="Pretendard Variable, sans-serif"),
                      legend=dict(orientation="h"))
    fig.update_xaxes(gridcolor="#ebebeb")
    fig.update_yaxes(gridcolor="#ebebeb")
    return fig

with tab_kospi:
    st.plotly_chart(draw_index_chart(kospi.copy(), "코스피"), use_container_width=True)

with tab_kosdaq:
    st.plotly_chart(draw_index_chart(kosdaq.copy(), "코스닥"), use_container_width=True)

# 투자 원칙
st.markdown("---")
st.markdown("""
#### 시장 국면별 행동 원칙
| 국면 | 포지션 비중 | 전략 |
|------|------------|------|
| 🟢 상승 추세 | 70~100% | 거래량돌파, 골든크로스 적극 활용 |
| 🟡 횡보 | 30~50% | 재료주, 눌림목 반등만 선별 |
| 🔴 하락 추세 | 0~20% | 현금 보유, 손절 철저 |
| 🟠 단기 조정 | 30~50% | 대기, 반등 확인 후 진입 |
""")
