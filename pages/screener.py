import streamlit as st
import pandas as pd

from core.styles import inject
inject(st)

# ── 헤더 ─────────────────────────────────────────────
st.markdown("""
<div style='margin-bottom:1.5rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>SCREENER</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>
    종목 스크리너
  </div>
  <div style='font-size:.875rem;color:#7b7b7b;margin-top:.3rem'>
    거래량 돌파 · 골든크로스 · 눌림목 반등 종목을 자동 발굴합니다
  </div>
</div>
""", unsafe_allow_html=True)

# ── 컨트롤 바 ─────────────────────────────────────────
st.markdown("""
<div style='background:#ffffff;border-radius:14px;padding:1.25rem 1.5rem;
            box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem'>
""", unsafe_allow_html=True)

ctrl1, ctrl2, ctrl3 = st.columns([2, 4, 2])
with ctrl1:
    market = st.selectbox("시장", ["ALL", "KOSPI", "KOSDAQ"],
                          label_visibility="collapsed")
with ctrl2:
    max_stocks = st.slider("스캔 종목 수", 50, 500, 150, 50,
                           label_visibility="collapsed",
                           format="%d종목")
with ctrl3:
    run = st.button("🚀 스크리닝 시작", type="primary", use_container_width=True)

st.caption(f"선택: {market} · {max_stocks}종목 기준 약 {max_stocks//60}~{max_stocks//50}분 소요")
st.markdown("</div>", unsafe_allow_html=True)

# ── 전략 설명 ─────────────────────────────────────────
with st.expander("전략 설명"):
    st.markdown("""
- 🔥 **거래량돌파**: 오늘 거래량 > 20일 평균 2배 + 20일선 위 + RSI 정상
- 📈 **골든크로스/MACD전환**: 5일선이 20일선 상향 돌파 또는 MACD 매수 전환
- 🎯 **눌림목반등**: 단기 고점 대비 -3~-15% 조정 후 60일선 위에서 반등 시도
""")

# ── 스크리닝 실행 ─────────────────────────────────────
if run:
    from core.screener import run_screener
    progress = st.progress(0)
    status   = st.empty()

    def cb(done, total, name):
        progress.progress(done / total)
        status.text(f"스캔 중... {done}/{total} — {name}")

    with st.spinner("스캔 중..."):
        df = run_screener(market=market, max_stocks=max_stocks, progress_cb=cb)

    progress.empty()
    status.empty()

    if df.empty:
        st.markdown("""
<div style='background:#ffffff;border-radius:14px;padding:2.5rem;text-align:center;
            box-shadow:0 1px 4px rgba(0,0,0,.07)'>
  <div style='font-size:1.5rem;margin-bottom:.5rem'>🔍</div>
  <div style='font-size:.9375rem;color:#7b7b7b'>조건을 만족하는 종목이 없습니다.</div>
</div>""", unsafe_allow_html=True)
    else:
        # 결과 헤더
        col_result, col_filter = st.columns([3, 2])
        with col_result:
            st.markdown(f"""
<div style='font-size:1rem;font-weight:600;color:#191919;margin-bottom:.75rem'>
  총 <span style='color:#3182f6'>{len(df)}</span>개 종목 발굴
</div>""", unsafe_allow_html=True)
        with col_filter:
            strategies = ["전체"] + sorted(df["전략"].unique().tolist())
            sel = st.selectbox("전략 필터", strategies, label_visibility="collapsed")

        if sel != "전체":
            df = df[df["전략"].str.contains(sel)]

        # ── 결과 테이블 ───────────────────────────────
        rows_html = ""
        for i, row in enumerate(df.itertuples()):
            ret   = float(getattr(row, "등락률", 0))
            score = int(getattr(row, "점수", 0))
            strat = str(getattr(row, "전략", ""))
            price = int(getattr(row, "현재가", 0)) if hasattr(row, "현재가") else 0
            vol_r = float(getattr(row, "거래량비율", 0)) if hasattr(row, "거래량비율") else 0
            rsi   = float(getattr(row, "RSI", 0)) if hasattr(row, "RSI") else 0

            ret_c = "#f04452" if ret >= 0 else "#3182f6"
            sign  = "+" if ret >= 0 else ""
            arrow = "▲" if ret >= 0 else "▼"
            score_w = max(4, min(score, 100))
            score_c = "#3182f6" if score >= 70 else ("#f59e0b" if score >= 50 else "#7b7b7b")
            bg = "#ffffff" if i % 2 == 0 else "#fafafa"

            strat_badge = f"""<span style='background:#f0f5ff;color:#3182f6;
                font-size:.75rem;font-weight:600;padding:.2rem .65rem;
                border-radius:20px;white-space:nowrap'>{strat}</span>"""

            price_str = f"{price:,}원" if price else "—"
            vol_str   = f"{vol_r:.1f}배" if vol_r else "—"
            rsi_str   = f"{rsi:.0f}" if rsi else "—"

            rows_html += f"""
<tr style='background:{bg};border-bottom:1px solid #f4f4f8'>
  <td style='padding:.875rem 1rem;font-size:.875rem;font-weight:500;
             color:#b0b0b8;text-align:center;width:48px'>{i+1}</td>
  <td style='padding:.875rem 1rem'>
    <div style='font-size:.9375rem;font-weight:600;color:#191919'>{row.종목명}</div>
    <div style='font-size:.75rem;color:#b0b0b8;margin-top:.1rem'>{row.티커}</div>
  </td>
  <td style='padding:.875rem 1rem;text-align:right;font-variant-numeric:tabular-nums'>
    <div style='font-size:.9375rem;font-weight:600;color:#191919'>{price_str}</div>
  </td>
  <td style='padding:.875rem 1rem;text-align:right'>
    <span style='font-size:.9375rem;font-weight:700;color:{ret_c}'>
      {arrow} {sign}{ret:.1f}%
    </span>
  </td>
  <td style='padding:.875rem 1rem;text-align:center;color:#7b7b7b;
             font-size:.875rem;font-variant-numeric:tabular-nums'>{vol_str}</td>
  <td style='padding:.875rem 1rem;text-align:center;color:#7b7b7b;
             font-size:.875rem;font-variant-numeric:tabular-nums'>{rsi_str}</td>
  <td style='padding:.875rem 1.25rem;min-width:130px'>
    <div style='display:flex;align-items:center;gap:.5rem'>
      <div style='flex:1;height:5px;background:#ebebeb;border-radius:5px;overflow:hidden'>
        <div style='width:{score_w}%;height:100%;background:{score_c};border-radius:5px'></div>
      </div>
      <span style='font-size:.8125rem;font-weight:700;color:{score_c};white-space:nowrap'>
        {score}점
      </span>
    </div>
  </td>
  <td style='padding:.875rem 1rem'>{strat_badge}</td>
</tr>"""

        st.markdown(f"""
<div style='background:#ffffff;border-radius:14px;overflow:hidden;
            box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem'>
  <table style='width:100%;border-collapse:collapse'>
    <thead>
      <tr style='border-bottom:1.5px solid #ebebeb'>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:center;background:#f8f8f8;width:48px'>#</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:left;background:#f8f8f8'>종목명</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:right;background:#f8f8f8'>현재가</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:right;background:#f8f8f8'>등락률</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:center;background:#f8f8f8'>거래량비율</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:center;background:#f8f8f8'>RSI</th>
        <th style='padding:.75rem 1.25rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:left;background:#f8f8f8;min-width:130px'>신호점수</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;
                   color:#7b7b7b;text-align:left;background:#f8f8f8'>전략</th>
      </tr>
    </thead>
    <tbody>{rows_html}</tbody>
  </table>
</div>
""", unsafe_allow_html=True)

        col_tip, col_dl = st.columns([4, 1])
        with col_tip:
            st.caption("💡 관심 종목 티커를 복사해 종목분석 페이지에서 상세 분석하세요")
        with col_dl:
            csv = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
            st.download_button("📥 CSV", csv, "screener_result.csv", "text/csv",
                               use_container_width=True)

else:
    st.markdown("""
<div style='background:#ffffff;border-radius:14px;padding:3rem;text-align:center;
            box-shadow:0 1px 4px rgba(0,0,0,.07)'>
  <div style='font-size:2.5rem;margin-bottom:.75rem'>🔍</div>
  <div style='font-size:.9375rem;font-weight:500;color:#7b7b7b;margin-bottom:.5rem'>
    시장과 스캔 종목 수를 선택한 후 <b style="color:#3182f6">스크리닝 시작</b>을 눌러주세요
  </div>
  <div style='font-size:.8125rem;color:#b0b0b8;line-height:1.8'>
    결과 확인 → 관심 종목 선택 → 종목분석 → 리스크계산기로 수량 계산 → 진입
  </div>
</div>""", unsafe_allow_html=True)
