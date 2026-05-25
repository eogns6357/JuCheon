"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { fmt, signColor } from "@/lib/stocks";

interface Trade {
  id: string;
  date: string;
  ticker: string;
  name: string;
  type: "매수" | "매도";
  price: number;
  shares: number;
  fee: number;
  memo: string;
}

const STORAGE_KEY = "trades_v1";

function load(): Trade[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(trades: Trade[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    ticker: "", name: "", type: "매수" as "매수" | "매도",
    price: "", shares: "", fee: "0.015", memo: "",
  });

  useEffect(() => {
    setTrades(load());
  }, []);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleAdd() {
    const price = parseFloat(form.price);
    const shares = parseInt(form.shares);
    if (!form.date || !form.ticker || !price || !shares) return;

    const trade: Trade = {
      id: Date.now().toString(),
      date: form.date,
      ticker: form.ticker,
      name: form.name || form.ticker,
      type: form.type,
      price,
      shares,
      fee: parseFloat(form.fee) || 0,
      memo: form.memo,
    };
    const updated = [trade, ...trades];
    setTrades(updated);
    save(updated);
    setForm((f) => ({ ...f, price: "", shares: "", memo: "" }));
  }

  function handleDelete(id: string) {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    save(updated);
  }

  const totalProfit = trades.reduce((sum, t) => {
    const amount = t.price * t.shares;
    const fee = amount * (t.fee / 100);
    return t.type === "매수" ? sum - amount - fee : sum + amount - fee;
  }, 0);

  const buyCount = trades.filter((t) => t.type === "매수").length;
  const sellCount = trades.filter((t) => t.type === "매도").length;

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#191919] mb-6">매매 일지</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-[#7b7b7b] mb-1">누적 손익 (수수료 포함)</p>
          <p className={`text-xl font-bold num ${signColor(totalProfit)}`}>
            {totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)}원
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-[#7b7b7b] mb-1">매수 건수</p>
          <p className="text-xl font-bold num text-[#f04452]">{buyCount}건</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-[#7b7b7b] mb-1">매도 건수</p>
          <p className="text-xl font-bold num text-[#2979ff]">{sellCount}건</p>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-[#191919] mb-4">거래 추가</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">날짜</label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
              className="bg-[#fafafa] border-[#ebebeb] rounded-xl h-10 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">종목코드</label>
            <Input value={form.ticker} onChange={(e) => set("ticker", e.target.value)}
              placeholder="005930" className="bg-[#fafafa] border-[#ebebeb] rounded-xl h-10 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">종목명</label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="삼성전자" className="bg-[#fafafa] border-[#ebebeb] rounded-xl h-10 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">구분</label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              className="w-full h-10 bg-[#fafafa] border border-[#ebebeb] rounded-xl px-3 text-sm text-[#191919]"
            >
              <option value="매수">매수</option>
              <option value="매도">매도</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">매매가 (원)</label>
            <Input value={form.price} onChange={(e) => set("price", e.target.value)}
              placeholder="75000" className="bg-[#fafafa] border-[#ebebeb] rounded-xl h-10 text-sm num" />
          </div>
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">수량 (주)</label>
            <Input value={form.shares} onChange={(e) => set("shares", e.target.value)}
              placeholder="10" className="bg-[#fafafa] border-[#ebebeb] rounded-xl h-10 text-sm num" />
          </div>
          <div>
            <label className="text-xs text-[#7b7b7b] mb-1 block">수수료 (%)</label>
            <Input value={form.fee} onChange={(e) => set("fee", e.target.value)}
              placeholder="0.015" className="bg-[#fafafa] border-[#ebebeb] rounded-xl h-10 text-sm num" />
          </div>
        </div>
        <Textarea
          value={form.memo}
          onChange={(e) => set("memo", e.target.value)}
          placeholder="매매 근거 메모..."
          className="bg-[#fafafa] border-[#ebebeb] rounded-xl text-sm mb-3 resize-none"
          rows={2}
        />
        <Button
          onClick={handleAdd}
          className="bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl px-6 h-10 font-semibold"
        >
          추가
        </Button>
      </div>

      {/* 거래 내역 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {trades.length === 0 ? (
          <p className="text-center text-sm text-[#b0b0b8] py-10">거래 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#f0f0f5]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7b7b7b]">날짜</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7b7b7b]">종목</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#7b7b7b]">구분</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">가격</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">수량</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7b7b7b]">금액</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7b7b7b]">메모</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-[#f0f0f5] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-4 py-3 text-[#555]">{t.date}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#191919]">{t.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        t.type === "매수" ? "bg-[#f04452]/10 text-[#f04452]" : "bg-[#2979ff]/10 text-[#2979ff]"
                      }`}>{t.type}</span>
                    </td>
                    <td className="px-4 py-3 text-right num">{fmt(t.price)}</td>
                    <td className="px-4 py-3 text-right num">{fmt(t.shares)}</td>
                    <td className="px-4 py-3 text-right num font-medium">{fmt(t.price * t.shares)}</td>
                    <td className="px-4 py-3 text-[#7b7b7b] max-w-[200px] truncate">{t.memo}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-[#b0b0b8] hover:text-[#f04452] transition-colors text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
