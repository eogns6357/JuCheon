import {
  RSI, MACD, BollingerBands, SMA, ATR,
} from "technicalindicators";

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function calcIndicators(data: OHLCV[]) {
  const closes = data.map((d) => d.close);
  const highs  = data.map((d) => d.high);
  const lows   = data.map((d) => d.low);

  const rsiArr = RSI.calculate({ values: closes, period: 14 });
  const macdArr = MACD.calculate({
    values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });
  const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const ma5   = SMA.calculate({ values: closes, period: 5 });
  const ma20  = SMA.calculate({ values: closes, period: 20 });
  const ma60  = SMA.calculate({ values: closes, period: 60 });
  const ma120 = SMA.calculate({ values: closes, period: 120 });
  const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  const pad = (arr: unknown[], len: number) =>
    [...Array(len - arr.length).fill(null), ...arr];
  const n = data.length;

  return data.map((d, i) => ({
    ...d,
    rsi:   (pad(rsiArr, n)[i]  as number | null),
    macd:  (pad(macdArr, n)[i] as { MACD: number; signal: number; histogram: number } | null),
    bb:    (pad(bbArr, n)[i]   as { upper: number; middle: number; lower: number } | null),
    ma5:   (pad(ma5, n)[i]     as number | null),
    ma20:  (pad(ma20, n)[i]    as number | null),
    ma60:  (pad(ma60, n)[i]    as number | null),
    ma120: (pad(ma120, n)[i]   as number | null),
    atr:   (pad(atrArr, n)[i]  as number | null),
  }));
}

/**
 * 외국인·기관 수급 보너스 (-10 ~ +10)
 * 외국인 5일 순매수 > 0: +5, 기관도 양수: +3 추가(쌍끌이 +2), 외국인 매도: -5
 */
export function calcInvestorBonus(foreign5d: number, inst5d: number): number {
  let bonus = 0;
  if (foreign5d > 0) bonus += 5;
  if (inst5d > 0) bonus += 3;
  if (foreign5d > 0 && inst5d > 0) bonus += 2;
  if (foreign5d < 0) bonus -= 5;
  return Math.min(10, Math.max(-10, bonus));
}

/**
 * 통합 시그널 점수 (0 ~ 100)
 *
 * 카테고리별 배점:
 *   RSI          최대 +15  (과매수 시 -5 패널티)
 *   MACD         최대 +25  (히스토그램 +15, 라인 +10)
 *   이평선 위치   최대 +33  (MA5+8, MA20+15, MA60+10)
 *   이평선 정배열 최대 +12  (MA20 > MA60)
 *   볼린저밴드    최대  +5  (상단 초과 시 -5)
 *   거래량 비율   최대 +10
 *   수급 보너스   최대 +10  (외국인·기관 순매수)
 *
 * volRatio: 20일 평균 대비 당일 거래량 배율 (기본 1.0)
 * investorBonus: calcInvestorBonus() 결과 (-10 ~ +10, 기본 0)
 */
export function signalScore(
  data: ReturnType<typeof calcIndicators>,
  volRatio = 1,
  investorBonus = 0,
): number {
  const last = data[data.length - 1];
  let score = 0;

  // RSI
  if (last.rsi !== null) {
    if      (last.rsi >= 40 && last.rsi < 65) score += 15;
    else if (last.rsi >= 65 && last.rsi < 72) score += 8;
    else if (last.rsi < 30)                   score += 5;  // 과매도 반등 가능성
    if      (last.rsi > 75)                   score -= 5;  // 과매수 리스크
  }

  // MACD
  if (last.macd) {
    if (last.macd.histogram > 0)          score += 15;
    if (last.macd.MACD > last.macd.signal) score += 10;
  }

  // 이평선 위치
  if (last.ma5  && last.close > last.ma5)  score += 8;
  if (last.ma20 && last.close > last.ma20) score += 15;
  if (last.ma60 && last.close > last.ma60) score += 10;

  // 이평선 정배열 (MA20 > MA60)
  if (last.ma20 && last.ma60 && last.ma20 > last.ma60) score += 12;

  // 볼린저밴드
  if (last.bb) {
    if (last.close > last.bb.middle) score += 5;
    if (last.close > last.bb.upper)  score -= 5;
  }

  // 거래량
  if      (volRatio >= 2.0) score += 10;
  else if (volRatio >= 1.5) score += 5;

  return Math.min(100, Math.max(0, score + investorBonus));
}
