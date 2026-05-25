/**
 * JUCHEON 급등 감지기
 * 실행: node scripts/watcher.mjs
 * 종료: Ctrl+C
 *
 * 장중(09:00~15:30 KST) 15초마다 KIS 등락률 순위를 조회해
 * 10% 이상 종목 발견 시 텔레그램으로 즉시 알림.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── .env.local 로드 ───────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(__dir, "../.env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
} catch {
  console.error(".env.local 파일을 찾을 수 없습니다.");
  process.exit(1);
}

const {
  KIS_APP_KEY, KIS_APP_SECRET,
  KIS_MODE = "real",
  TELEGRAM_ALERT_TOKEN, TELEGRAM_ALERT_CHAT_ID,
  TELEGRAM_TOKEN, TELEGRAM_CHAT_ID,
} = process.env;

// 급등 전용 봇 우선, 없으면 기존 주천봇 사용
const BOT_TOKEN = TELEGRAM_ALERT_TOKEN || TELEGRAM_TOKEN;
const BOT_CHAT_ID = TELEGRAM_ALERT_CHAT_ID || TELEGRAM_CHAT_ID;

if (!KIS_APP_KEY || !KIS_APP_SECRET) {
  console.error("KIS_APP_KEY / KIS_APP_SECRET 환경변수가 없습니다.");
  process.exit(1);
}

const KIS_BASE = KIS_MODE === "real"
  ? "https://openapi.koreainvestment.com:9443"
  : "https://openapivts.koreainvestment.com:29443";

// ── KIS 토큰 ─────────────────────────────────────────────────────────────────
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`);
  _token = data.access_token;
  _tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return _token;
}

async function kisGet(path, params, trId) {
  const token = await getToken();
  const url = new URL(`${KIS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
      tr_id: trId,
      custtype: "P",
    },
  });
  return res.json();
}

// ── 급등 기준 (3단계) ────────────────────────────────────────────────────────
// TIER 1: 28%+            → 상한가 근접, 무조건 알림
// TIER 2: 15%+ & 거래대금 50억+  → 진짜 모멘텀
// TIER 3: 10%+ & 거래대금 50억+ & 9:30 이전 → 장 초반 선취매 기회
// 공통 제외: 거래대금 10억 미만 (유동성 부족)

const MIN_TRADING_VALUE = 10_000_000_000;  // 10억
const STRONG_TRADING_VALUE = 50_000_000_000; // 50억

function isEarlySession() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const totalMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return totalMin < 9 * 60 + 30; // 09:30 이전
}

function classifyStock(stock) {
  const { rate, tradingValue } = stock;
  if (tradingValue < MIN_TRADING_VALUE) return null;        // 유동성 부족 제외
  if (rate >= 28) return "UPPER_LIMIT";                    // 상한가 근접
  if (rate >= 15 && tradingValue >= STRONG_TRADING_VALUE) return "STRONG"; // 강한 모멘텀
  if (rate >= 10 && tradingValue >= STRONG_TRADING_VALUE && isEarlySession()) return "EARLY"; // 장 초반
  return null;
}

const TIER_LABEL = {
  UPPER_LIMIT: "🔥 상한가 근접",
  STRONG:      "🚀 급등 포착",
  EARLY:       "⚡ 장 초반 강세",
};

async function fetchGainers() {
  const data = await kisGet(
    "/uapi/domestic-stock/v1/ranking/fluctuation",
    {
      fid_rsfl_rate1: "10",
      fid_rsfl_rate2: "",
      fid_cond_mrkt_div_code: "J",
      fid_cond_scr_div_code: "20170",
      fid_input_iscd: "0000",
      fid_rank_sort_cls_code: "0",
      fid_input_cnt_1: "0",
      fid_prc_cls_code: "1",
      fid_input_price_1: "",
      fid_input_price_2: "",
      fid_vol_cnt: "",
      fid_trgt_cls_code: "0",
      fid_trgt_exls_cls_code: "0000000000",
      fid_div_cls_code: "0",
      fid_blng_cls_code: "0",
      fid_input_date_1: "",
    },
    "FHPST01710000"
  );

  const stocks = (data.output ?? []).map((r) => ({
    ticker: r.mksc_shrn_iscd?.trim(),
    name: r.hts_kor_isnm?.trim(),
    rate: parseFloat(r.prdy_ctrt ?? "0"),
    price: parseInt(r.stck_prpr ?? "0", 10),
    volume: parseInt(r.acml_vol ?? "0", 10),
    tradingValue: parseInt(r.acml_tr_pbmn ?? "0", 10),
  }));

  return stocks
    .filter((s) => s.ticker && s.name)
    .map((s) => ({ ...s, tier: classifyStock(s) }))
    .filter((s) => s.tier !== null);
}

// ── 텔레그램 ─────────────────────────────────────────────────────────────────
async function sendTelegram(text) {
  if (!BOT_TOKEN || !BOT_CHAT_ID) {
    console.log("[텔레그램 미설정] 메시지:", text);
    return;
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: BOT_CHAT_ID, text, parse_mode: "HTML" }),
  });
}

// ── 중복 방지 ────────────────────────────────────────────────────────────────
const alerted = new Map(); // ticker → last alert timestamp
const DEDUP_MS = 30 * 60 * 1000; // 30분 내 재알림 없음

// ── 장 시간 체크 (KST) ───────────────────────────────────────────────────────
function isMarketOpen() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  if (day === 0 || day === 6) return false;
  const totalMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return totalMin >= 9 * 60 && totalMin < 15 * 60 + 30;
}

function nowKST() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// ── 메인 스캔 ────────────────────────────────────────────────────────────────
async function scan() {
  if (!isMarketOpen()) {
    process.stdout.write(`\r[${nowKST()}] 장 시간 외 — 대기 중   `);
    return;
  }

  try {
    const gainers = await fetchGainers();

    if (gainers.length === 0) {
      process.stdout.write(`\r[${nowKST()}] 조건 충족 종목 없음   `);
      return;
    }

    // 새로 발견된 종목만 필터
    const fresh = gainers.filter((s) => {
      const last = alerted.get(s.ticker);
      return !last || Date.now() - last > DEDUP_MS;
    });

    console.log(`\n[${nowKST()}] ${gainers.length}개 발견 / 신규 ${fresh.length}개`);

    if (fresh.length === 0) return;

    const lines = fresh.map((s) => {
      const valueLabel = s.tradingValue >= 100_000_000
        ? `거래대금 ${(s.tradingValue / 100_000_000).toFixed(0)}억`
        : `거래대금 ${s.tradingValue.toLocaleString()}원`;
      return (
        `${TIER_LABEL[s.tier]} <b>${s.name}</b> (${s.ticker})\n` +
        `   +${s.rate.toFixed(2)}%  |  ${s.price.toLocaleString()}원  |  ${valueLabel}`
      );
    });

    const msg = `🚨 <b>급등 감지</b> [${nowKST()}]\n\n` + lines.join("\n\n");

    await sendTelegram(msg);

    for (const s of fresh) {
      alerted.set(s.ticker, Date.now());
      console.log(`  ✅ [${s.tier}] ${s.name} (${s.ticker})  +${s.rate.toFixed(2)}%`);
    }
  } catch (e) {
    console.error(`\n[${nowKST()}] 오류:`, e.message);
  }
}

// ── 테스트 모드 ──────────────────────────────────────────────────────────────
const TEST_MODE = process.argv.includes("--test");

async function runTest() {
  console.log("🧪 테스트 모드 — 장 시간·임계값 무시\n");

  // 1) 텔레그램 연결 확인
  console.log("① 텔레그램 연결 테스트...");
  await sendTelegram(
    `🧪 <b>JUCHEON 급등봇 테스트</b>\n\n` +
    `upjucheonbot 연결 성공!\n` +
    `실제 운영 시 아래 기준으로 알림이 옵니다:\n\n` +
    `🔥 상한가 근접 (28%+)\n` +
    `🚀 급등 포착 (15%+ & 거래대금 50억+)\n` +
    `⚡ 장 초반 강세 (10%+ & 거래대금 50억+ & 9:30 이전)\n\n` +
    `예시:\n` +
    `🚀 급등 포착 <b>한미반도체</b> (042700)\n` +
    `   +17.50%  |  95,000원  |  거래대금 312억`
  );
  console.log("  ✅ 텔레그램 발송 완료\n");

  // 2) KIS API 연결 확인 (임계값 0%로 조회)
  console.log("② KIS 등락률 순위 API 테스트...");
  try {
    const data = await kisGet(
      "/uapi/domestic-stock/v1/ranking/fluctuation",
      {
        fid_rsfl_rate1: "0",
        fid_rsfl_rate2: "",
        fid_cond_mrkt_div_code: "J",
        fid_cond_scr_div_code: "20170",
        fid_input_iscd: "0000",
        fid_rank_sort_cls_code: "0",
        fid_input_cnt_1: "0",
        fid_prc_cls_code: "1",
        fid_input_price_1: "",
        fid_input_price_2: "",
        fid_vol_cnt: "",
        fid_trgt_cls_code: "0",
        fid_trgt_exls_cls_code: "0000000000",
        fid_div_cls_code: "0",
        fid_blng_cls_code: "0",
        fid_input_date_1: "",
      },
      "FHPST01710000"
    );

    const top5 = (data.output ?? []).slice(0, 5);
    if (top5.length === 0) {
      console.log("  ⚠️  종목 데이터 없음 (장 마감 후엔 빈 결과가 정상)");
      console.log("     API 연결은 정상입니다. 장 중에 실행하면 데이터가 나옵니다.");
    } else {
      console.log("  ✅ KIS API 응답 정상 — 현재 상위 5종목:");
      for (const r of top5) {
        const name = (r.hts_kor_isnm ?? "?").trim();
        const rate = parseFloat(r.prdy_ctrt ?? "0").toFixed(2);
        const price = parseInt(r.stck_prpr ?? "0", 10).toLocaleString();
        console.log(`     ${name}  ${rate > 0 ? "+" : ""}${rate}%  ${price}원`);
      }
    }
  } catch (e) {
    console.log("  ❌ KIS API 오류:", e.message);
  }

  console.log("\n✅ 테스트 완료. 실제 감지는 npm run watch 로 실행하세요.");
}

// ── 시작 ─────────────────────────────────────────────────────────────────────
const INTERVAL_SEC = 15;

if (TEST_MODE) {
  runTest();
} else {
  const botLabel = TELEGRAM_ALERT_TOKEN ? "급등 전용 봇 (upjucheonbot)" : "주천봇 (전용 봇 미설정)";

  console.log("━".repeat(50));
  console.log("  JUCHEON 급등 감지기");
  console.log("  🔥 상한가 근접 : 28%+");
  console.log("  🚀 급등 포착   : 15%+ & 거래대금 50억+");
  console.log("  ⚡ 장초반 강세 : 10%+ & 거래대금 50억+ & 9:30 이전");
  console.log(`  폴링: ${INTERVAL_SEC}초 | 재알림 방지: 30분`);
  console.log(`  알림 봇: ${botLabel}`);
  console.log("  Ctrl+C로 종료");
  console.log("━".repeat(50) + "\n");

  scan();
  setInterval(scan, INTERVAL_SEC * 1000);
}
