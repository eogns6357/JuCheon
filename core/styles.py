TOSS_CSS = """
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

/* ── Base ─────────────────────────────────────── */
html, body,
[data-testid="stAppViewContainer"],
[data-testid="stApp"] {
    background-color: #f0f0f5 !important;
    font-family: 'Pretendard Variable', 'Pretendard', -apple-system,
                 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif !important;
    color: #191919 !important;
}
[data-testid="stMain"],
[data-testid="stMainBlockContainer"] {
    background-color: #f0f0f5 !important;
}
section[data-testid="stSidebar"] {
    background-color: #ffffff !important;
    border-right: 1px solid #ebebeb !important;
}
section[data-testid="stSidebar"] * { color: #191919 !important; }

/* ── Typography ───────────────────────────────── */
h1 { font-size: 1.75rem !important; font-weight: 700 !important;
     letter-spacing: -0.02em !important; color: #191919 !important; }
h2 { font-size: 1.375rem !important; font-weight: 700 !important;
     letter-spacing: -0.01em !important; color: #191919 !important; }
h3 { font-size: 1rem !important; font-weight: 600 !important;
     color: #191919 !important; letter-spacing: 0 !important;
     text-transform: none !important; }
p, li, span { color: #191919 !important; }

/* ── HR ───────────────────────────────────────── */
hr {
    border: none !important;
    border-top: 1px solid #ebebeb !important;
    margin: 1.25rem 0 !important;
}

/* ── Metric Cards ─────────────────────────────── */
[data-testid="stMetric"] {
    background: #ffffff !important;
    border: none !important;
    border-radius: 14px !important;
    padding: 1.25rem 1.5rem !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07) !important;
    transition: box-shadow .2s ease !important;
}
[data-testid="stMetric"]:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important;
}
[data-testid="stMetricLabel"] p {
    font-size: .8125rem !important;
    font-weight: 500 !important;
    color: #7b7b7b !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
}
[data-testid="stMetricValue"] {
    font-size: 1.5rem !important;
    font-weight: 700 !important;
    color: #191919 !important;
    font-variant-numeric: tabular-nums !important;
}
[data-testid="stMetricDelta"] {
    font-size: .8125rem !important;
    font-weight: 600 !important;
}

/* ── Buttons ──────────────────────────────────── */
.stButton > button {
    font-family: inherit !important;
    font-size: .875rem !important;
    font-weight: 600 !important;
    border-radius: 10px !important;
    padding: .5rem 1.25rem !important;
    border: 1px solid #ebebeb !important;
    background: #ffffff !important;
    color: #191919 !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    transition: all .15s ease !important;
}
.stButton > button:hover {
    background: #f8f8f8 !important;
    border-color: #d0d0d8 !important;
    transform: none !important;
}
.stButton > button[kind="primary"] {
    background: #3182f6 !important;
    border-color: #3182f6 !important;
    color: #ffffff !important;
}
.stButton > button[kind="primary"]:hover {
    background: #1b64da !important;
    border-color: #1b64da !important;
}

/* ── Inputs ───────────────────────────────────── */
.stTextInput > div > div > input,
.stNumberInput > div > div > input {
    background: #ffffff !important;
    border: 1.5px solid #ebebeb !important;
    border-radius: 10px !important;
    padding: .625rem 1rem !important;
    font-size: .9375rem !important;
    color: #191919 !important;
    font-family: inherit !important;
}
.stTextInput > div > div > input:focus,
.stNumberInput > div > div > input:focus {
    border-color: #3182f6 !important;
    box-shadow: 0 0 0 3px rgba(49,130,246,.12) !important;
}
.stTextInput > div > div > input::placeholder { color: #b0b0b8 !important; }

/* ── Selectbox ────────────────────────────────── */
[data-baseweb="select"] > div {
    background: #ffffff !important;
    border: 1.5px solid #ebebeb !important;
    border-radius: 10px !important;
    color: #191919 !important;
}
[data-baseweb="select"] > div:focus-within {
    border-color: #3182f6 !important;
    box-shadow: 0 0 0 3px rgba(49,130,246,.12) !important;
}
[data-baseweb="popover"] {
    background: #ffffff !important;
    border: 1px solid #ebebeb !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,.12) !important;
}
[role="option"] { background: #ffffff !important; color: #191919 !important; }
[role="option"]:hover { background: #f0f5ff !important; }

/* ── Tabs ─────────────────────────────────────── */
[data-testid="stTabs"] [role="tablist"] {
    border-bottom: 1.5px solid #ebebeb !important;
    gap: 0 !important;
    background: transparent !important;
}
[data-testid="stTabs"] button[role="tab"] {
    font-family: inherit !important;
    font-size: .9375rem !important;
    font-weight: 500 !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: #7b7b7b !important;
    padding: .75rem 1.25rem !important;
    border-radius: 0 !important;
    border: none !important;
    background: transparent !important;
}
[data-testid="stTabs"] button[role="tab"][aria-selected="true"] {
    color: #3182f6 !important;
    font-weight: 700 !important;
    border-bottom: 2.5px solid #3182f6 !important;
}

/* ── Alerts ───────────────────────────────────── */
[data-testid="stAlert"] {
    border-radius: 12px !important;
    border: none !important;
    font-size: .875rem !important;
}

/* ── DataFrames ───────────────────────────────── */
[data-testid="stDataFrame"],
.stDataFrame {
    border-radius: 14px !important;
    overflow: hidden !important;
    border: none !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.07) !important;
}
[data-testid="stDataFrame"] th {
    background: #f8f8f8 !important;
    color: #7b7b7b !important;
    font-size: .8125rem !important;
    font-weight: 500 !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    border-bottom: 1px solid #ebebeb !important;
}
[data-testid="stDataFrame"] td {
    background: #ffffff !important;
    color: #191919 !important;
    border-bottom: 1px solid #f4f4f8 !important;
    font-variant-numeric: tabular-nums !important;
}

/* ── Progress ─────────────────────────────────── */
[data-testid="stProgress"] > div {
    background: #ebebeb !important;
    border-radius: 4px !important;
}
[data-testid="stProgress"] > div > div {
    background: #3182f6 !important;
    border-radius: 4px !important;
}

/* ── Caption ──────────────────────────────────── */
[data-testid="stCaptionContainer"] p,
small { color: #b0b0b8 !important; font-size: .75rem !important; }

/* ── Toggle / Checkbox ────────────────────────── */
[data-testid="stToggle"] span,
[data-testid="stCheckbox"] span { color: #191919 !important; }

/* ── Page Links ───────────────────────────────── */
[data-testid="stPageLink"] a {
    background: #ffffff !important;
    border: none !important;
    border-radius: 14px !important;
    padding: 1.25rem !important;
    color: #191919 !important;
    text-decoration: none !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.07) !important;
    transition: all .2s ease !important;
    display: block !important;
}
[data-testid="stPageLink"] a:hover {
    box-shadow: 0 6px 20px rgba(0,0,0,.1) !important;
    transform: translateY(-2px) !important;
    color: #3182f6 !important;
}

/* ── Scrollbar ────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: #f0f0f5; }
::-webkit-scrollbar-thumb { background: #d0d0d8; border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: #3182f6; }

/* ── Utility classes ──────────────────────────── */
.t-card {
    background: #ffffff;
    border-radius: 14px;
    padding: 1.5rem;
    box-shadow: 0 1px 4px rgba(0,0,0,.07);
}
.t-label {
    font-size: .8125rem;
    font-weight: 500;
    color: #7b7b7b;
}
.t-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: #191919;
    letter-spacing: -.01em;
}
.t-pos { color: #f04452 !important; font-weight: 700; }
.t-neg { color: #3182f6 !important; font-weight: 700; }
.t-gray { color: #b0b0b8 !important; }
.t-badge {
    display: inline-block;
    padding: .2rem .7rem;
    border-radius: 20px;
    font-size: .75rem;
    font-weight: 600;
}
</style>
"""

def inject(st_module=None):
    if st_module:
        st_module.markdown(TOSS_CSS, unsafe_allow_html=True)
