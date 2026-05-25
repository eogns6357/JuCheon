import streamlit as st
import os, json
from datetime import datetime

now = datetime.now()
market_open = now.weekday() < 5 and 900 <= now.hour * 100 + now.minute <= 1530

# ── 헤더 ─────────────────────────────────────────────
if market_open:
    status_bg, status_color, status_text = "#fff0f3", "#f04452", "🔴 장중"
else:
    status_bg, status_color, status_text = "#f4f4f8", "#b0b0b8", "장마감"

st.markdown(f"""
<div style='display:flex;align-items:center;justify-content:space-between;
            background:#ffffff;border-radius:16px;padding:1.25rem 1.75rem;
            box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem'>
  <div style='display:flex;align-items:center;gap:1rem'>
    <span style='font-size:1.5rem;font-weight:800;letter-spacing:-.03em;color:#191919'>
      개인 트레이더
    </span>
    <span style='font-size:.75rem;font-weight:600;padding:.25rem .75rem;
                 border-radius:20px;background:{status_bg};color:{status_color}'>
      {status_text}
    </span>
  </div>
  <span style='font-size:.8125rem;color:#b0b0b8;font-variant-numeric:tabular-nums'>
    {now.strftime('%Y. %m. %d  %H:%M')}
  </span>
</div>
""", unsafe_allow_html=True)

# ── 시장 지수 ─────────────────────────────────────────
@st.cache_data(ttl=60)
def load_indices():
    try:
        from core.data import get_market_index, get_kosdaq_index
        kp_df = get_market_index(5)
        kd_df = get_kosdaq_index(5)
        def _calc(df):
            cur  = float(df.iloc[-1]["종가"])
            prev = float(df.iloc[-2]["종가"]) if len(df) >= 2 else cur
            return cur, round((cur - prev) / prev * 100, 2), round(cur - prev)
        return _calc(kp_df) + _calc(kd_df)
    except:
        return 0, 0, 0, 0, 0, 0

kp, kp_r, kp_d, kd, kd_r, kd_d = load_indices()

def _ticker_html(name, val, rate, diff):
    c = "#f04452" if rate >= 0 else "#3182f6"
    sign = "+" if rate >= 0 else ""
    arrow = "▲" if rate >= 0 else "▼"
    return f"""
<div style='background:#ffffff;border-radius:14px;padding:1.25rem 1.5rem;
            box-shadow:0 1px 4px rgba(0,0,0,.07);flex:1;min-width:0'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.35rem'>{name}</div>
  <div style='font-size:1.5rem;font-weight:700;color:#191919;
              font-variant-numeric:tabular-nums;letter-spacing:-.01em'>{val:,.2f}</div>
  <div style='font-size:.875rem;font-weight:600;color:{c};margin-top:.25rem'>
    {arrow} {sign}{rate:.2f}%
    <span style='font-size:.8125rem;font-weight:500;margin-left:.25rem'>({sign}{diff:,.0f})</span>
  </div>
</div>"""

def _status_html():
    if market_open:
        bg, tc, txt = "#fff0f3", "#f04452", "📈 정규장 진행 중"
    elif now.weekday() >= 5:
        day = "토요일" if now.weekday() == 5 else "일요일"
        bg, tc, txt = "#f4f4f8", "#7b7b7b", f"📅 {day} — 월요일 개장"
    elif now.hour * 100 < 900:
        mins = 9 * 60 - (now.hour * 60 + now.minute)
        bg, tc, txt = "#fffbf0", "#f59e0b", f"⏰ 장 시작까지 {mins}분"
    else:
        bg, tc, txt = "#f4f4f8", "#7b7b7b", "⬛ 장마감 (15:30)"
    return f"""
<div style='background:{bg};border-radius:14px;padding:1.25rem 1.5rem;
            box-shadow:0 1px 4px rgba(0,0,0,.07);flex:1;min-width:0;
            display:flex;align-items:center;justify-content:center'>
  <span style='font-size:1rem;font-weight:600;color:{tc}'>{txt}</span>
</div>"""

st.markdown(f"""
<div style='display:flex;gap:.75rem;margin-bottom:1rem'>
  {_ticker_html("KOSPI", kp, kp_r, kp_d)}
  {_ticker_html("KOSDAQ", kd, kd_r, kd_d)}
  {_status_html()}
</div>
""", unsafe_allow_html=True)

# ── 오늘의 신호 ───────────────────────────────────────
SIGNAL_CACHE = os.path.join("data", "signals.json")

signals, scan_time = [], ""
if os.path.exists(SIGNAL_CACHE):
    with open(SIGNAL_CACHE, encoding="utf-8") as f:
        saved = json.load(f)
    signals   = saved.get("data", [])
    scan_time = saved.get("time", "")

col_hdr, col_btn = st.columns([5, 1])
with col_hdr:
    scan_lbl = f"<span style='font-size:.8125rem;color:#b0b0b8'>마지막 스캔: {scan_time}</span>" if scan_time else ""
    st.markdown(f"""
<div style='margin-bottom:.5rem'>
  <div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>TODAY'S SIGNALS</div>
  <div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em'>오늘의 매매 신호</div>
  {scan_lbl}
</div>""", unsafe_allow_html=True)

with col_btn:
    st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
    if st.button("지금 스캔", type="primary", use_container_width=True):
        with st.spinner("스캔 중..."):
            from core.screener import run_screener
            df_s = run_screener(market="ALL", max_stocks=150)
            if not df_s.empty:
                os.makedirs("data", exist_ok=True)
                with open(SIGNAL_CACHE, "w", encoding="utf-8") as f:
                    json.dump({"time": now.strftime("%H:%M"),
                               "data": df_s.head(10).to_dict("records")},
                              f, ensure_ascii=False)
                st.rerun()

if signals:
    rows_html = ""
    for i, s in enumerate(signals[:10]):
        ret   = s.get("등락률", 0)
        score = s.get("점수", 0)
        strat = s.get("전략", "")
        ret_c = "#f04452" if ret >= 0 else "#3182f6"
        sign  = "+" if ret >= 0 else ""
        arrow = "▲" if ret >= 0 else "▼"
        score_w = max(4, min(score, 100))
        score_c = "#3182f6" if score >= 70 else "#7b7b7b"
        bg = "#f9f9ff" if i % 2 == 0 else "#ffffff"
        strat_badge = f"""<span style='background:#f0f5ff;color:#3182f6;
            font-size:.75rem;font-weight:600;padding:.15rem .6rem;
            border-radius:20px'>{strat}</span>"""
        rows_html += f"""
<tr style='background:{bg}'>
  <td style='padding:.875rem 1rem;font-size:.875rem;font-weight:500;
             color:#7b7b7b;text-align:center;width:40px'>{i+1}</td>
  <td style='padding:.875rem 1rem'>
    <div style='font-size:.9375rem;font-weight:600;color:#191919'>{s["종목명"]}</div>
    <div style='font-size:.75rem;color:#b0b0b8;margin-top:.1rem'>{s["티커"]}</div>
  </td>
  <td style='padding:.875rem 1rem;text-align:right'>
    <div style='font-size:.9375rem;font-weight:600;color:#191919;font-variant-numeric:tabular-nums'>
      {s.get("현재가", 0):,}원
    </div>
  </td>
  <td style='padding:.875rem 1rem;text-align:right'>
    <span style='font-size:.9375rem;font-weight:700;color:{ret_c}'>{arrow} {sign}{ret:.1f}%</span>
  </td>
  <td style='padding:.875rem 1.25rem;min-width:140px'>
    <div style='display:flex;align-items:center;gap:.5rem'>
      <div style='flex:1;height:6px;background:#ebebeb;border-radius:6px;overflow:hidden'>
        <div style='width:{score_w}%;height:100%;background:{score_c};border-radius:6px'></div>
      </div>
      <span style='font-size:.8125rem;font-weight:600;color:{score_c};white-space:nowrap'>{score}점</span>
    </div>
  </td>
  <td style='padding:.875rem 1rem'>{strat_badge}</td>
</tr>"""

    st.markdown(f"""
<div style='background:#ffffff;border-radius:14px;overflow:hidden;
            box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem'>
  <table style='width:100%;border-collapse:collapse'>
    <thead>
      <tr style='border-bottom:1px solid #ebebeb'>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;color:#7b7b7b;text-align:center;background:#f8f8f8;width:40px'>#</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;color:#7b7b7b;text-align:left;background:#f8f8f8'>종목명</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;color:#7b7b7b;text-align:right;background:#f8f8f8'>현재가</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;color:#7b7b7b;text-align:right;background:#f8f8f8'>등락률</th>
        <th style='padding:.75rem 1.25rem;font-size:.8125rem;font-weight:500;color:#7b7b7b;text-align:left;background:#f8f8f8;min-width:140px'>신호점수</th>
        <th style='padding:.75rem 1rem;font-size:.8125rem;font-weight:500;color:#7b7b7b;text-align:left;background:#f8f8f8'>전략</th>
      </tr>
    </thead>
    <tbody>{rows_html}</tbody>
  </table>
</div>
""", unsafe_allow_html=True)
else:
    st.markdown("""
<div style='background:#ffffff;border-radius:14px;padding:3rem;text-align:center;
            box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem'>
  <div style='font-size:2.5rem;margin-bottom:.75rem'>📭</div>
  <div style='font-size:.9375rem;font-weight:500;color:#7b7b7b'>
    스캔 결과 없음 — <b style="color:#3182f6">지금 스캔</b> 버튼으로 오늘의 신호를 찾아보세요
  </div>
</div>""", unsafe_allow_html=True)

# ── 빠른 실행 ─────────────────────────────────────────
st.markdown("""
<div style='font-size:.8125rem;font-weight:500;color:#7b7b7b;margin-bottom:.2rem'>NAVIGATION</div>
<div style='font-size:1.375rem;font-weight:700;color:#191919;letter-spacing:-.01em;margin-bottom:1rem'>빠른 실행</div>
""", unsafe_allow_html=True)

nav_pages = [
    ("pages/quote.py",    "📡", "실시간 시세",   "현재가 · 호가 · 분봉차트"),
    ("pages/screener.py", "🔍", "종목 스크리너", "오늘 주목 종목 발굴"),
    ("pages/analysis.py", "📊", "종목 분석",     "기술지표 · 차트 분석"),
    ("pages/risk_calc.py","💰", "리스크 계산기", "수량 · 손절 · 목표가"),
    ("pages/journal.py",  "📓", "매매 일지",     "기록 · 승률 · 손익비"),
    ("pages/market.py",   "🌊", "시장 흐름",     "코스피 · 코스닥 국면"),
    ("pages/news.py",     "📰", "뉴스 · 공시",   "종목 뉴스 조회"),
    ("pages/alerts.py",   "🔔", "알림 설정",     "텔레그램 자동 알림"),
]

c1, c2, c3, c4 = st.columns(4)
cols_nav = [c1, c2, c3, c4]
for i, (path, icon, name, desc) in enumerate(nav_pages):
    with cols_nav[i % 4]:
        st.page_link(path, label=f"{icon}  **{name}**\n\n{desc}", use_container_width=True)

st.markdown("""
<div style='text-align:center;margin-top:1.5rem;padding:.75rem;
            background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.07)'>
  <span style='font-size:.8125rem;color:#b0b0b8'>
    시장흐름 확인 → 스크리너 → 종목분석 → 리스크계산 → 직접주문 → 일지기록
  </span>
</div>
""", unsafe_allow_html=True)
