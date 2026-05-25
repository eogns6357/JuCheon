try:
    import streamlit as st
    _s = st.secrets
    KIS_APP_KEY        = _s.get("KIS_APP_KEY", "")
    KIS_APP_SECRET     = _s.get("KIS_APP_SECRET", "")
    KIS_ACCOUNT        = _s.get("KIS_ACCOUNT", "")
    KIS_ACCOUNT_SUFFIX = _s.get("KIS_ACCOUNT_SUFFIX", "01")
    KIS_MODE           = _s.get("KIS_MODE", "real")
    DART_API_KEY       = _s.get("DART_API_KEY", "")
    GOOGLE_API_KEY     = _s.get("GOOGLE_API_KEY", "")
    TELEGRAM_TOKEN     = _s.get("TELEGRAM_TOKEN", "")
    TELEGRAM_CHAT_ID   = _s.get("TELEGRAM_CHAT_ID", "")
except Exception:
    KIS_APP_KEY        = ""
    KIS_APP_SECRET     = ""
    KIS_ACCOUNT        = ""
    KIS_ACCOUNT_SUFFIX = "01"
    KIS_MODE           = "real"
    DART_API_KEY       = ""
    GOOGLE_API_KEY     = ""
    TELEGRAM_TOKEN     = ""
    TELEGRAM_CHAT_ID   = ""

# 로컬 실행 시 local_config.py 값으로 덮어씀
try:
    from local_config import *
except ImportError:
    pass
