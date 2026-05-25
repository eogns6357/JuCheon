import streamlit as st

from core.styles import inject
inject(st)

st.markdown("""
<div style='margin-bottom:1.25rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>RISK MANAGEMENT</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>리스크 계산기</div>
  <div style='font-size:.875rem;color:#7b7b7b;margin-top:.3rem'>
    매매 전 반드시 계산하세요 — 손절가 없는 매수는 도박입니다
  </div>
</div>
""", unsafe_allow_html=True)

col_input, col_result = st.columns([1, 1])

with col_input:
    st.markdown("### 입력")
    capital = st.number_input("총 투자 가능 자본 (원)", value=10_000_000, step=1_000_000,
                               format="%d")
    entry = st.number_input("매수 예정가 (원)", value=50_000, step=100, format="%d")
    stop_loss = st.number_input("손절가 (원)", value=47_500, step=100, format="%d",
                                 help="보통 ATR 1.5배 아래 or 최근 N일 저점")
    risk_pct = st.slider("1회 매매 최대 손실 허용 (자본 대비 %)",
                          0.5, 3.0, 1.0, 0.5,
                          help="초보는 1% 추천. 자본 1000만이면 10만원 손실 한도")

    st.markdown("---")
    ticker = st.text_input("티커 (ATR 자동 계산용, 선택)", "")
    use_atr = st.checkbox("ATR 기반 손절가 자동 계산")

    if use_atr and ticker:
        from core.data import get_ohlcv
        from core.indicators import add_indicators
        from core.risk import atr_stop
        with st.spinner("ATR 계산 중..."):
            df = get_ohlcv(ticker, 60)
            if not df.empty:
                df = add_indicators(df)
                atr_val = atr_stop(df)
                st.info(f"ATR 기반 권장 손절가: **{atr_val:,}원**")
                if st.button("이 값으로 손절가 설정"):
                    stop_loss = atr_val

with col_result:
    st.markdown("### 계산 결과")
    from core.risk import calculate_position, calculate_targets, rrr_ok

    if entry > 0 and stop_loss > 0 and stop_loss < entry:
        result = calculate_position(capital, entry, stop_loss, risk_pct)
        targets = calculate_targets(entry, stop_loss)

        if result:
            loss_pct = (entry - stop_loss) / entry * 100

            # 검증
            rrr_pass = rrr_ok(entry, targets["목표2 (1:2)"], stop_loss, min_rrr=2.0)

            r1, r2 = st.columns(2)
            r1.metric("매수 수량", f"{result['매수수량']:,}주")
            r2.metric("포지션 금액", f"{result['포지션금액']:,}원",
                      f"자본의 {result['포지션비율']}%")

            r3, r4 = st.columns(2)
            r3.metric("최대 손실액", f"{result['최대손실액']:,}원",
                      f"자본의 {risk_pct}%", delta_color="off")
            r4.metric("손절폭", f"{result['손절폭']}%")

            st.markdown("---")
            st.markdown("### 목표가")
            t1, t2, t3 = st.columns(3)
            t1.metric("목표1 (1:1.5)", f"{targets['목표1 (1:1.5)']:,}원",
                      f"+{(targets['목표1 (1:1.5)']-entry)/entry*100:.1f}%")
            t2.metric("목표2 (1:2.0)", f"{targets['목표2 (1:2)']:,}원",
                      f"+{(targets['목표2 (1:2)']-entry)/entry*100:.1f}%")
            t3.metric("목표3 (1:3.0)", f"{targets['목표3 (1:3)']:,}원",
                      f"+{(targets['목표3 (1:3)']-entry)/entry*100:.1f}%")

            st.markdown("---")
            if rrr_pass:
                st.success("✅ 손익비 2:1 이상 — 진입 고려 가능")
            else:
                st.error("❌ 손익비 부족 — 손절가를 낮추거나 목표가를 높이세요")

            # 매매 요약 카드
            st.markdown("### 매매 요약")
            st.code(f"""
매수가:   {entry:,}원  × {result['매수수량']}주
손절가:   {stop_loss:,}원  (손절폭: -{loss_pct:.1f}%)
목표1:    {targets['목표1 (1:1.5)']:,}원
목표2:    {targets['목표2 (1:2)']:,}원
최대손실: {result['최대손실액']:,}원  (자본의 {risk_pct}%)
            """)
    elif entry <= stop_loss:
        st.error("손절가는 매수가보다 낮아야 합니다")
    else:
        st.info("왼쪽에서 값을 입력하면 자동 계산됩니다")

st.markdown("---")
st.markdown("""
**사용 팁**
- 손절가는 차트에서 **직전 저점** 또는 **20일선** 아래로 설정
- 1회 손실 한도를 **1%** 이하로 유지하면 연속 10번 손절해도 자본 90% 이상 유지
- 손익비 2:1 미만이면 승률 50%로도 장기적으로 손실
""")
