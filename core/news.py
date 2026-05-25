"""
DART 공시 조회 (OpenDartReader 무료 API)
사용하려면: https://opendart.fss.or.kr 에서 무료 API키 발급
"""
import requests
import pandas as pd
from datetime import datetime, timedelta

DART_API_KEY = ""  # config.py에서 주입

def set_api_key(key: str):
    global DART_API_KEY
    DART_API_KEY = key

def get_disclosures(corp_name: str = "", days: int = 3) -> pd.DataFrame:
    """최근 N일 공시 조회"""
    if not DART_API_KEY:
        return pd.DataFrame({"안내": ["DART API 키를 config.py에 입력해주세요"]})

    end = datetime.now()
    start = end - timedelta(days=days)
    url = "https://opendart.fss.or.kr/api/list.json"
    params = {
        "crtfc_key": DART_API_KEY,
        "corp_name": corp_name,
        "bgn_de": start.strftime("%Y%m%d"),
        "end_de": end.strftime("%Y%m%d"),
        "page_count": 40,
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        data = r.json()
        if data.get("status") != "000":
            return pd.DataFrame()
        items = data.get("list", [])
        df = pd.DataFrame(items)[["corp_name", "report_nm", "rcept_dt", "flr_nm"]]
        df.columns = ["종목명", "공시유형", "공시일", "제출인"]
        return df
    except Exception as e:
        return pd.DataFrame({"오류": [str(e)]})

def get_naver_news(query: str, display: int = 10) -> list[dict]:
    """네이버 금융 뉴스 (무료, API키 불필요)"""
    url = f"https://finance.naver.com/news/news_search.naver?q={query}&x=0&y=0"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        from bs4 import BeautifulSoup
        r = requests.get(url, headers=headers, timeout=8)
        soup = BeautifulSoup(r.text, "html.parser")
        items = []
        for a in soup.select("dl dd.articleSubject a")[:display]:
            items.append({"제목": a.text.strip(), "링크": "https://finance.naver.com" + a["href"]})
        return items
    except:
        return []
