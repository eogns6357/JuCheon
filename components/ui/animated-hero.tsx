"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_URL = "https://jucheon.streamlit.app/";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["스크리너", "AI 분석", "리스크 관리", "매매 일지", "실시간 시세"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber((prev) => (prev === titles.length - 1 ? 0 : prev + 1));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full min-h-screen bg-[#f0f0f5] flex flex-col">
      {/* 헤더 */}
      <header className="w-full px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-xl font-bold tracking-tight text-[#191919]">
          개인 트레이더
        </span>
        <a href={APP_URL} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl gap-2">
            앱 열기 <MoveRight className="w-4 h-4" />
          </Button>
        </a>
      </header>

      {/* 히어로 */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-6">
          <div className="flex gap-8 py-20 items-center justify-center flex-col">

            {/* 배지 */}
            <div>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 rounded-full bg-white shadow-sm text-[#3182f6] border-0 font-medium"
              >
                <BarChart2 className="w-4 h-4" />
                한국 주식 단기 매매 대시보드
              </Button>
            </div>

            {/* 타이틀 */}
            <div className="flex gap-4 flex-col items-center">
              <h1 className="text-5xl md:text-7xl max-w-2xl tracking-tighter text-center font-bold text-[#191919]">
                <span>나만의</span>
                <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1 h-[1.2em]">
                  &nbsp;
                  {titles.map((title, index) => (
                    <motion.span
                      key={index}
                      className="absolute font-bold text-[#3182f6]"
                      initial={{ opacity: 0, y: 80 }}
                      transition={{ type: "spring", stiffness: 60, damping: 15 }}
                      animate={
                        titleNumber === index
                          ? { y: 0, opacity: 1 }
                          : {
                              y: titleNumber > index ? -80 : 80,
                              opacity: 0,
                            }
                      }
                    >
                      {title}
                    </motion.span>
                  ))}
                </span>
                <span className="block mt-2">도구</span>
              </h1>

              <p className="text-lg md:text-xl leading-relaxed tracking-tight text-[#7b7b7b] max-w-xl text-center mt-2">
                종목 스크리너부터 AI 분석, 리스크 계산, 매매 일지까지.
                <br className="hidden md:block" />
                투자 판단에 필요한 모든 것을 한 곳에서.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex flex-row gap-3 flex-wrap justify-center">
              <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="gap-3 bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-xl px-8 text-base font-semibold shadow-md"
                >
                  대시보드 시작하기 <MoveRight className="w-5 h-5" />
                </Button>
              </a>
              <a href="https://github.com/eogns6357/JuCheon" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-3 rounded-xl px-8 text-base font-semibold border-[#ebebeb] bg-white hover:bg-[#f8f8f8]"
                >
                  GitHub 보기
                </Button>
              </a>
            </div>

            {/* 기능 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 w-full max-w-2xl">
              {[
                { icon: "📡", label: "실시간 시세" },
                { icon: "🔍", label: "종목 스크리너" },
                { icon: "📊", label: "AI 종목 분석" },
                { icon: "💰", label: "리스크 계산기" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-2xl p-4 text-center shadow-sm flex flex-col items-center gap-2"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-sm font-medium text-[#191919]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 면책 조항 */}
      <footer className="w-full text-center py-6 px-4">
        <p className="text-xs text-[#b0b0b8] max-w-xl mx-auto leading-relaxed">
          본 서비스는 개인 학습 및 정보 제공 목적으로 제작된 도구입니다.
          투자 권유가 아니며, 투자 판단 및 손익은 전적으로 이용자 본인에게 있습니다.
        </p>
      </footer>
    </div>
  );
}

export { Hero };
