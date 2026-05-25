"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface Props {
  title: string;
  body: string;
}

export function TermHelp({ title, body }: Props) {
  const [hover, setHover] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setCanHover(mq.matches);
    const onChange = () => setCanHover(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  function openModal() {
    setHover(false);
    setModalOpen(true);
  }

  return (
    <>
      <span className="relative inline-flex align-middle ml-1 -mt-px">
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[#c8c8d0] hover:text-[#7b7b7b] hover:bg-[#f0f0f5] transition-colors"
          aria-label={`${title} 설명 보기`}
          onMouseEnter={() => canHover && setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => canHover && setHover(true)}
          onBlur={() => setHover(false)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!canHover) openModal();
          }}
        >
          <HelpCircle className="size-3.5" strokeWidth={2} />
        </button>

        {canHover && hover && (
          <div
            role="tooltip"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-[60] w-[min(260px,calc(100vw-2rem))] rounded-xl border border-white/60 bg-white/75 backdrop-blur-md px-3.5 py-2.5 shadow-md pointer-events-none"
          >
            <p className="text-xs font-semibold text-[#191919]/95 mb-1">{title}</p>
            <p className="text-[11px] text-[#333]/90 leading-relaxed">{body}</p>
          </div>
        )}
      </span>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="term-help-title"
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 id="term-help-title" className="text-base font-bold text-[#191919]">
                {title}
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="shrink-0 p-1 rounded-lg text-[#b0b0b8] hover:bg-[#f0f0f5] hover:text-[#555]"
                aria-label="닫기"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-[#555] leading-relaxed">{body}</p>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#3182f6] text-white text-sm font-semibold"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
