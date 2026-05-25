"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/stocks";

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f5] last:border-0 ${highlight ? "bg-[#3182f6]/5" : ""}`}>
      <span className="text-sm text-[#555]">{label}</span>
      <span className={`text-sm font-semibold num ${highlight ? "text-[#3182f6]" : "text-[#191919]"}`}>{value}</span>
    </div>
  );
}

export default function RiskPage() {
  const [account, setAccount] = useState("10000000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");

  const accountNum = parseFloat(account.replace(/,/g, "")) || 0;
  const riskPctNum = parseFloat(riskPct) || 1;
  const entryNum = parseFloat(entry.replace(/,/g, "")) || 0;
  const stopNum = parseFloat(stop.replace(/,/g, "")) || 0;
  const targetNum = parseFloat(target.replace(/,/g, "")) || 0;

  const riskAmount = accountNum * (riskPctNum / 100);
  const stopDiff = entryNum - stopNum;
  const shares = stopDiff > 0 ? Math.floor(riskAmount / stopDiff) : 0;
  const positionSize = shares * entryNum;
  const positionPct = accountNum > 0 ? (positionSize / accountNum) * 100 : 0;
  const maxLoss = shares * stopDiff;
  const expectedGain = targetNum > 0 && shares > 0 ? shares * (targetNum - entryNum) : 0;
  const rr = maxLoss > 0 && expectedGain > 0 ? expectedGain / maxLoss : 0;

  function numInput(value: string, setter: (v: string) => void) {
    return (
      <Input
        value={value}
        onChange={(e) => setter(e.target.value.replace(/[^\d.]/g, ""))}
        className="bg-white border-[#ebebeb] rounded-xl h-11 text-right num"
      />
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">리스크 계산기</h1>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-[#191919] mb-4">입력</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#555] w-32 shrink-0">계좌 잔고 (원)</label>
            {numInput(account, setAccount)}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#555] w-32 shrink-0">리스크 비율 (%)</label>
            <div className="flex-1 flex items-center gap-2">
              {numInput(riskPct, setRiskPct)}
              <span className="text-sm text-[#7b7b7b] shrink-0">%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#555] w-32 shrink-0">진입가 (원)</label>
            {numInput(entry, setEntry)}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#555] w-32 shrink-0">손절가 (원)</label>
            {numInput(stop, setStop)}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#555] w-32 shrink-0">목표가 (원)</label>
            {numInput(target, setTarget)}
          </div>
        </div>
      </div>

      {entryNum > 0 && stopNum > 0 && entryNum > stopNum && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f0f0f5]">
            <h2 className="text-sm font-semibold text-[#191919]">계산 결과</h2>
          </div>
          <Row label="허용 손실액" value={fmt(riskAmount) + "원"} />
          <Row label="매수 수량" value={fmt(shares) + "주"} highlight />
          <Row label="포지션 금액" value={fmt(positionSize) + "원"} />
          <Row label="계좌 대비 비중" value={positionPct.toFixed(1) + "%"} />
          <Row label="최대 손실액" value={fmt(maxLoss) + "원"} />
          {targetNum > 0 && (
            <>
              <Row label="예상 수익액" value={fmt(expectedGain) + "원"} />
              <Row
                label="손익비 (R:R)"
                value={rr > 0 ? "1 : " + rr.toFixed(2) : "-"}
                highlight={rr >= 2}
              />
            </>
          )}
        </div>
      )}

      {entryNum > 0 && stopNum > 0 && entryNum <= stopNum && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#f04452]/20">
          <p className="text-sm text-[#f04452]">손절가는 진입가보다 낮아야 합니다.</p>
        </div>
      )}

      <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-[#b0b0b8] leading-relaxed">
          일반적으로 1회 거래 리스크는 계좌의 <strong>1~2%</strong> 이내를 권장합니다.
          손익비(R:R)는 최소 <strong>1:2 이상</strong>이 유리합니다.
        </p>
      </div>
    </div>
  );
}
