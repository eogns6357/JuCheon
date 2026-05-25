
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TELEGRAM_LINK = "https://t.me/+XxG9M-TY1gpmY2Nl";
const ALERT_CHANNEL_LINK = "https://t.me/+k1G5uv5BFxg2ZGM1";
const APP_URL = "https://jucheon.streamlit.app/";

export default function AlertsPage() {
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const { data: config } = useSWR("/api/telegram", fetcher);

  async function sendTest() {
    setSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test" }),
      });
      const data = await res.json();
      setTestResult(data.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    } finally {
      setSending(false);
    }
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(TELEGRAM_LINK)}&bgcolor=ffffff&color=191919&margin=10`;

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">알림 설정</h1>

      {/* QR 코드 안내 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
        <h2 className="text-base font-semibold text-[#191919] mb-2">주천 분석방</h2>
        <p className="text-sm text-[#7b7b7b] mb-5">
          QR 코드를 스캔하거나 링크를 통해 텔레그램 채널에 참여하세요.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt="텔레그램 봇 QR 코드"
          className="mx-auto rounded-2xl mb-4"
          width={180}
          height={180}
        />
        <a
          href={TELEGRAM_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-[#3182f6] font-medium hover:underline"
        >
          채널 참여하기 →
        </a>
      </div>

      {/* 급등 알림 채널 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
        <h2 className="text-base font-semibold text-[#191919] mb-2">주천 급등방</h2>
        <p className="text-sm text-[#7b7b7b] mb-5">
          장 중 10% 이상 급등 종목을 실시간으로 알려드립니다.
        </p>
        {(() => {
          const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ALERT_CHANNEL_LINK)}&bgcolor=ffffff&color=191919&margin=10`;
          return (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="급등방 QR 코드" className="mx-auto rounded-2xl mb-4" width={180} height={180} />
            </>
          );
        })()}
        <a
          href={ALERT_CHANNEL_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-[#f04452] font-medium hover:underline"
        >
          급등방 참여하기 →
        </a>
      </div>

      {/* 앱 알림 링크 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-[#191919] mb-3">대시보드 링크</h2>
        <div className="flex items-center gap-3 bg-[#f5f5f8] rounded-xl px-4 py-3">
          <span className="text-sm text-[#555] flex-1 truncate">{APP_URL}</span>
          <button
            onClick={() => navigator.clipboard.writeText(APP_URL)}
            className="text-xs text-[#3182f6] font-medium shrink-0"
          >
            복사
          </button>
        </div>
      </div>

      {/* 테스트 메시지 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#191919] mb-1">연결 테스트</h2>
        <p className="text-xs text-[#7b7b7b] mb-4">
          설정된 텔레그램 채널로 테스트 메시지를 발송합니다.
        </p>

        {config && (
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${config.configured ? "bg-green-400" : "bg-gray-300"}`} />
            <span className="text-xs text-[#7b7b7b]">
              {config.configured ? `봇 설정됨 (채팅 ID: ···${config.chatId})` : "봇 미설정"}
            </span>
          </div>
        )}

        <Button
          onClick={sendTest}
          disabled={sending || !config?.configured}
          className="bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl h-10 px-5 font-semibold"
        >
          {sending ? "발송 중..." : "테스트 메시지 발송"}
        </Button>

        {testResult === "ok" && (
          <p className="mt-3 text-sm text-green-600 font-medium">메시지가 성공적으로 발송되었습니다.</p>
        )}
        {testResult === "fail" && (
          <p className="mt-3 text-sm text-[#f04452]">발송 실패. 봇 설정을 확인해주세요.</p>
        )}
      </div>
    </div>
  );
}
