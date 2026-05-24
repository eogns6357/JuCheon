import streamlit as st
import pandas as pd

from core.styles import inject
inject(st)

st.markdown("""
<div style='margin-bottom:1.25rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>TRADE JOURNAL</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>매매 일지</div>
</div>
""", unsafe_allow_html=True)

from core.journal import load, add_trade, close_trade, stats

tab_list, tab_add, tab_stats = st.tabs(["📋 매매 내역", "➕ 매매 기록", "📊 통계"])

with tab_list:
    df = load()
    if df.empty:
        st.info("아직 기록된 매매가 없습니다. '매매 기록' 탭에서 추가하세요.")
    else:
        # 보유중 종목 강조
        holding = df[df["결과"] == "보유중"]
        closed = df[df["결과"].isin(["수익", "손실"])]

        if not holding.empty:
            st.markdown("#### 보유중")
            st.dataframe(holding, use_container_width=True)

            st.markdown("#### 매도 처리")
            idx = st.number_input("행 번호 (0부터)", 0, len(df)-1, 0)
            sell_price = st.number_input("매도가 (원)", value=0, step=100)
            if st.button("매도 완료 처리"):
                if sell_price > 0:
                    close_trade(idx, sell_price)
                    st.success("처리 완료!")
                    st.rerun()

        if not closed.empty:
            st.markdown("#### 종료된 매매")
            def color_profit(val):
                try:
                    return "color: red" if float(val) > 0 else "color: blue"
                except:
                    return ""
            styled = closed.style.applymap(color_profit, subset=["손익", "수익률"])
            st.dataframe(styled, use_container_width=True)

        csv = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
        st.download_button("📥 일지 다운로드", csv, "journal.csv", "text/csv")

with tab_add:
    st.markdown("#### 새 매매 기록")
    c1, c2 = st.columns(2)
    with c1:
        name = st.text_input("종목명")
        ticker = st.text_input("티커")
        entry = st.number_input("매수가", value=0, step=100)
        qty = st.number_input("수량", value=0, step=1)
    with c2:
        stop = st.number_input("손절가", value=0, step=100)
        target = st.number_input("목표가", value=0, step=100)
        strategy = st.selectbox("전략", ["거래량돌파", "골든크로스", "눌림목반등", "직접선택", "기타"])
        memo = st.text_area("메모", height=80)

    if st.button("기록 저장", type="primary"):
        if name and ticker and entry > 0 and qty > 0:
            add_trade(name, ticker, entry, qty, stop, target, strategy, memo)
            st.success("저장 완료!")
            st.rerun()
        else:
            st.error("종목명, 티커, 매수가, 수량은 필수입니다")

with tab_stats:
    df = load()
    s = stats(df)
    if not s:
        st.info("종료된 매매가 없습니다. 매도 처리 후 통계가 나타납니다.")
    else:
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("총 매매 횟수", f"{s['총매매']}회")
        m2.metric("승률", f"{s['승률']}%",
                  "양호" if s['승률'] >= 50 else "개선필요")
        m3.metric("손익비", f"{s['손익비']}",
                  "양호" if s['손익비'] >= 2 else "개선필요")
        m4.metric("누적 손익", f"{s['총손익']:,}원",
                  delta_color="normal" if s['총손익'] >= 0 else "inverse")

        st.markdown("---")
        e1, e2, e3 = st.columns(3)
        e1.metric("평균 수익률 (이긴 매매)", f"{s['평균수익']}%")
        e2.metric("평균 손실률 (진 매매)", f"{s['평균손실']}%")
        e3.metric("기대값 (1회 평균)", f"{s['기대값']}%",
                  "양수면 장기 수익 가능" if s['기대값'] > 0 else "전략 재검토 필요")

        # 개선 제안
        st.markdown("---")
        st.markdown("#### 진단")
        issues = []
        if s['승률'] < 40:
            issues.append("❗ 승률이 낮습니다 — 진입 타이밍을 더 까다롭게 선택하세요")
        if s['손익비'] < 1.5:
            issues.append("❗ 손익비가 낮습니다 — 목표가를 손절폭의 2배 이상 설정하세요")
        if s['기대값'] < 0:
            issues.append("❗ 기대값이 마이너스 — 이 전략으로는 장기 손실 가능성이 높습니다")
        if not issues:
            st.success("✅ 승률과 손익비 모두 양호합니다. 전략을 유지하세요.")
        for i in issues:
            st.warning(i)
