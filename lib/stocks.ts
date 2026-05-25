export const POPULAR_STOCKS = [
  { ticker: "005930", name: "삼성전자" },
  { ticker: "000660", name: "SK하이닉스" },
  { ticker: "035420", name: "NAVER" },
  { ticker: "035720", name: "카카오" },
  { ticker: "005380", name: "현대차" },
  { ticker: "000270", name: "기아" },
  { ticker: "051910", name: "LG화학" },
  { ticker: "066570", name: "LG전자" },
  { ticker: "005490", name: "POSCO홀딩스" },
  { ticker: "105560", name: "KB금융" },
  { ticker: "055550", name: "신한지주" },
  { ticker: "086790", name: "하나금융지주" },
  { ticker: "012330", name: "현대모비스" },
  { ticker: "011200", name: "HMM" },
  { ticker: "003550", name: "LG" },
  { ticker: "032830", name: "삼성생명" },
  { ticker: "015760", name: "한국전력" },
  { ticker: "033780", name: "KT&G" },
  { ticker: "030200", name: "KT" },
  { ticker: "096770", name: "SK이노베이션" },
  { ticker: "034730", name: "SK" },
  { ticker: "028260", name: "삼성물산" },
  { ticker: "316140", name: "우리금융지주" },
  { ticker: "207940", name: "삼성바이오로직스" },
  { ticker: "068270", name: "셀트리온" },
  { ticker: "000100", name: "유한양행" },
  { ticker: "006400", name: "삼성SDI" },
  { ticker: "373220", name: "LG에너지솔루션" },
  { ticker: "247540", name: "에코프로비엠" },
  { ticker: "086280", name: "현대글로비스" },
];

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

export function kisDateToISO(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function signColor(rate: number): string {
  if (rate > 0) return "positive";
  if (rate < 0) return "negative";
  return "neutral";
}
