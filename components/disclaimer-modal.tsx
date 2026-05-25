"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "disclaimer_agreed_v1";

export function DisclaimerModal() {
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  function handleAgree() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-[#191919] mb-4">서비스 이용 전 확인사항</h2>
        <ul className="space-y-2 text-sm text-[#555] mb-5">
          <li className="flex gap-2">
            <span className="text-[#3182f6] shrink-0">•</span>
            본 서비스는 <strong>개인 학습 및 정보 제공</strong> 목적으로 제작된 도구입니다.
          </li>
          <li className="flex gap-2">
            <span className="text-[#3182f6] shrink-0">•</span>
            투자 권유·추천에 해당하지 않으며, 제공되는 분석 정보는 참고용입니다.
          </li>
          <li className="flex gap-2">
            <span className="text-[#3182f6] shrink-0">•</span>
            투자 판단 및 이에 따른 <strong>손익은 전적으로 이용자 본인</strong>에게 있습니다.
          </li>
          <li className="flex gap-2">
            <span className="text-[#3182f6] shrink-0">•</span>
            주가 데이터 및 AI 분석 결과는 지연되거나 부정확할 수 있습니다.
          </li>
          <li className="flex gap-2">
            <span className="text-[#3182f6] shrink-0">•</span>
            과거 수익률이 미래 수익을 보장하지 않습니다.
          </li>
        </ul>
        <label className="flex items-center gap-2.5 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 accent-[#3182f6]"
          />
          <span className="text-sm text-[#191919] font-medium">
            위 내용을 모두 확인하였으며, 이에 동의합니다.
          </span>
        </label>
        <Button
          onClick={handleAgree}
          disabled={!agreed}
          className="w-full bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl h-11 font-semibold"
        >
          동의하고 시작하기
        </Button>
      </div>
    </div>
  );
}
