"""
KRX 전체 종목 목록을 JSON으로 출력.
Next.js API Route에서 child_process로 호출됨.
"""
import sys
import json

try:
    import FinanceDataReader as fdr
    df = fdr.StockListing("KRX")[["Code", "Name"]].dropna()
    df = df[df["Code"].str.match(r"^\d{6}$")]
    result = [
        {"ticker": str(row["Code"]), "name": str(row["Name"])}
        for _, row in df.iterrows()
    ]
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    sys.stderr.write(str(e) + "\n")
    sys.exit(1)
