import streamlit as st
import requests
import io

from core.styles import inject
inject(st)

st.markdown("""
<div style='margin-bottom:1.25rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>NOTIFICATIONS</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>알림 설정</div>
</div>
""", unsafe_allow_html=True)

import config

# ── QR 코드 생성 ──────────────────────────────────────
@st.cache_data(ttl=3600)
def get_bot_info(token: str):
    try:
        r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=5)
        data = r.json()
        if data.get("ok"):
            return data["result"].get("username")
    except:
        pass
    return None

def make_qr(url: str):
    import qrcode
    from PIL import Image
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#191919", back_color="#ffffff")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

# ── 메인 UI ───────────────────────────────────────────
if not config.TELEGRAM_TOKEN:
    st.info("텔레그램 알림이 아직 설정되지 않았습니다.")
    st.stop()

bot_username = get_bot_info(config.TELEGRAM_TOKEN)

if bot_username:
    bot_url = f"https://t.me/{bot_username}"

    col_qr, col_desc = st.columns([1, 2])

    with col_qr:
        st.markdown("""
<div style='background:#ffffff;border-radius:14px;padding:1.5rem;
            box-shadow:0 1px 4px rgba(0,0,0,.07);text-align:center'>
""", unsafe_allow_html=True)
        qr_buf = make_qr(bot_url)
        st.image(qr_buf, width=200)
        st.markdown(f"""
  <div style='font-size:.75rem;color:#b0b0b8;margin-top:.5rem'>
    @{bot_username}
  </div>
</div>""", unsafe_allow_html=True)

    with col_desc:
        st.markdown(f"""
<div style='background:#ffffff;border-radius:14px;padding:1.75rem;
            box-shadow:0 1px 4px rgba(0,0,0,.07);height:100%'>
  <div style='font-size:1.125rem;font-weight:700;color:#191919;margin-bottom:1rem'>
    매매 신호 알림 받기
  </div>
  <div style='display:flex;flex-direction:column;gap:.875rem'>
    <div style='display:flex;align-items:flex-start;gap:.75rem'>
      <span style='background:#f0f5ff;color:#3182f6;font-size:.875rem;font-weight:700;
                   padding:.3rem .7rem;border-radius:20px;white-space:nowrap'>1</span>
      <div style='font-size:.9375rem;color:#191919;line-height:1.5'>
        QR코드를 스캔하거나<br>
        <b style='color:#3182f6'>@{bot_username}</b> 을 텔레그램에서 검색
      </div>
    </div>
    <div style='display:flex;align-items:flex-start;gap:.75rem'>
      <span style='background:#f0f5ff;color:#3182f6;font-size:.875rem;font-weight:700;
                   padding:.3rem .7rem;border-radius:20px;white-space:nowrap'>2</span>
      <div style='font-size:.9375rem;color:#191919;line-height:1.5'>
        봇과 대화를 시작
      </div>
    </div>
    <div style='display:flex;align-items:flex-start;gap:.75rem'>
      <span style='background:#f0f5ff;color:#3182f6;font-size:.875rem;font-weight:700;
                   padding:.3rem .7rem;border-radius:20px;white-space:nowrap'>3</span>
      <div style='font-size:.9375rem;color:#191919;line-height:1.5'>
        매매 신호 발생 시 자동으로 알림이 전송됩니다
      </div>
    </div>
  </div>
  <div style='margin-top:1.25rem;padding:.875rem 1rem;background:#f8f8f8;
              border-radius:10px;font-size:.8125rem;color:#7b7b7b;line-height:1.6'>
    신호점수 65점 이상 종목만 알림 · 당일 중복 알림 없음<br>
    장 시간(09:10 ~ 15:20)에만 작동
  </div>
</div>
""", unsafe_allow_html=True)

else:
    st.warning("봇 정보를 불러올 수 없습니다.")

# ── 스케줄러 (관리자 전용) ────────────────────────────
with st.expander("스케줄러 설정", expanded=False):
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
    stats   = scheduler.get_stats()

    if running:
        st.success(f"🟢 실행 중  |  오늘 스캔: {stats['checked']}종목  |  알림: {stats['found']}건")
        if st.button("⏹ 중지", use_container_width=True):
            scheduler.stop()
            st.rerun()
    else:
        st.info("⚪ 꺼져 있음")
        if st.button("▶ 시작", type="primary", use_container_width=True):
            st.success(scheduler.start(interval_min=interval, market=market, max_stocks=max_s))
            st.rerun()
