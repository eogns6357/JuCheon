import streamlit as st
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.styles import inject
inject(st)

st.markdown("""
<div style='margin-bottom:1.25rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>NOTIFICATIONS</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>텔레그램 알림 설정</div>
</div>
""", unsafe_allow_html=True)

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.py")

def read_config() -> dict:
    ns = {}
    with open(CONFIG_PATH, encoding="utf-8") as f:
        exec(f.read(), ns)
    return ns

def write_config_value(key: str, value: str):
    with open(CONFIG_PATH, encoding="utf-8") as f:
        lines = f.readlines()
    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{key} =") or line.strip().startswith(f"{key}="):
            new_lines.append(f'{key} = "{value}"\n')
        else:
            new_lines.append(line)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

cfg = read_config()

# ── STEP 1: 봇 토큰 ───────────────────────────────────
st.markdown("## 1단계 — 텔레그램 봇 만들기")
with st.expander("방법 보기", expanded=not bool(cfg.get("TELEGRAM_TOKEN"))):
    st.markdown("""
1. 텔레그램 앱에서 **@BotFather** 검색 → 대화 시작
2. `/newbot` 입력
3. 봇 이름 입력 (예: `내주식알림봇`)
4. 봇 아이디 입력 (예: `my_stock_alert_bot`) — 반드시 `bot`으로 끝나야 함
5. **HTTP API Token** 발급됨 → 아래에 붙여넣기
    """)

token = st.text_input("봇 토큰", value=cfg.get("TELEGRAM_TOKEN", ""),
                       placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ",
                       type="password")
if st.button("토큰 저장"):
    write_config_value("TELEGRAM_TOKEN", token)
    st.success("저장됨 — 페이지 새로고침 후 2단계 진행")
    st.rerun()

# ── STEP 2: Chat ID 조회 ─────────────────────────────
if cfg.get("TELEGRAM_TOKEN"):
    st.markdown("## 2단계 — Chat ID 확인")
    with st.expander("방법 보기", expanded=not bool(cfg.get("TELEGRAM_CHAT_ID"))):
        st.markdown("""
1. 텔레그램에서 방금 만든 봇을 검색해서 열기
2. **아무 메시지나** 하나 보내기 (예: `안녕`)
3. 아래 버튼 클릭 → Chat ID 자동 조회
        """)

    if st.button("🔍 Chat ID 자동 조회"):
        import requests
        try:
            r = requests.get(
                f"https://api.telegram.org/bot{cfg['TELEGRAM_TOKEN']}/getUpdates",
                timeout=10
            )
            updates = r.json().get("result", [])
            if updates:
                chat_id = str(updates[-1]["message"]["chat"]["id"])
                write_config_value("TELEGRAM_CHAT_ID", chat_id)
                st.success(f"Chat ID 저장: `{chat_id}`")
                st.rerun()
            else:
                st.warning("메시지를 받지 못했습니다. 봇에게 먼저 메시지를 보내주세요.")
        except Exception as e:
            st.error(f"오류: {e}")

    if cfg.get("TELEGRAM_CHAT_ID"):
        st.info(f"현재 Chat ID: `{cfg['TELEGRAM_CHAT_ID']}`")

# ── STEP 3: 테스트 ───────────────────────────────────
if cfg.get("TELEGRAM_TOKEN") and cfg.get("TELEGRAM_CHAT_ID"):
    st.markdown("## 3단계 — 연결 테스트")
    if st.button("📨 테스트 메시지 전송", type="primary"):
        import importlib, config as cfg_mod
        importlib.reload(cfg_mod)
        from core.telegram import test_message
        ok = test_message()
        if ok:
            st.success("✅ 텔레그램으로 메시지 전송 성공!")
        else:
            st.error("❌ 전송 실패 — 토큰과 Chat ID를 다시 확인해주세요")

    # ── STEP 4: 스케줄러 ──────────────────────────────
    st.markdown("---")
    st.markdown("## 4단계 — 자동 스크리닝 알림 설정")

    from core import scheduler
    col1, col2, col3 = st.columns(3)
    with col1:
        interval = st.selectbox("스크리닝 주기", [10, 20, 30, 60], index=2,
                                 format_func=lambda x: f"{x}분마다")
    with col2:
        market = st.selectbox("시장", ["ALL", "KOSPI", "KOSDAQ"])
    with col3:
        max_s = st.slider("스캔 종목 수", 50, 300, 150, 50)

    running = scheduler.is_running()
    stats = scheduler.get_stats()

    if running:
        st.success(f"🟢 스케줄러 실행 중 | 오늘 스캔: {stats['checked']}종목 | 알림: {stats['found']}건")
        if st.button("⏹ 스케줄러 중지", use_container_width=True):
            scheduler.stop()
            st.rerun()
    else:
        st.info("⚪ 스케줄러 꺼져 있음")
        if st.button("▶ 스케줄러 시작", type="primary", use_container_width=True):
            msg = scheduler.start(interval_min=interval, market=market, max_stocks=max_s)
            st.success(msg)
            st.rerun()

    st.markdown("""
    **알림 기준**
    - 신호점수 65점 이상 종목만 알림
    - 당일 한 번 알린 종목은 재알림 없음
    - 장 시간(09:10~15:20)에만 작동
    - 09:05 시장 브리핑 / 15:30 마감 요약 자동 발송
    """)

else:
    st.info("1단계부터 순서대로 진행해주세요.")
