import { NextRequest, NextResponse } from "next/server";

const APP_URL = "https://jucheon.streamlit.app/";

async function sendMessage(text: string) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram 설정 누락");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const { type, ticker, name, message } = await req.json();

  try {
    let text = "";
    if (type === "test") {
      text = `✅ 알림 테스트\n트레이더 대시보드에서 발송된 테스트 메시지입니다.\n\n<a href="${APP_URL}">대시보드 바로가기</a>`;
    } else if (type === "signal") {
      text = `📊 종목 시그널 알림\n${name ?? ticker}\n\n${message ?? ""}\n\n<a href="${APP_URL}">대시보드에서 확인</a>`;
    } else {
      text = message ?? "알림";
    }

    const result = await sendMessage(text);
    if (!result.ok) {
      return NextResponse.json({ error: result.description }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return NextResponse.json({
    configured: !!(token && chatId),
    chatId: chatId ? `...${chatId.slice(-4)}` : null,
  });
}
