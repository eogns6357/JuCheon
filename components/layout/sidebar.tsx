"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Radio, Search, TrendingUp,
  Calculator, BookOpen, Bell, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    items: [{ href: "/", label: "HOME", icon: Home }],
  },
  {
    label: "시세 · 분석",
    items: [
      { href: "/quote",    label: "종목 시세·분석·뉴스", icon: Radio },
      { href: "/screener", label: "종목 스크리너", icon: Search },
      { href: "/market",   label: "시장 흐름",    icon: TrendingUp },
    ],
  },
  {
    label: "매매 관리",
    items: [
      { href: "/risk",    label: "리스크 계산기", icon: Calculator },
      { href: "/journal", label: "매매 일지",     icon: BookOpen },
      { href: "/alerts",  label: "알림 설정",     icon: Bell },
    ],
  },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-[1px] flex items-center justify-center relative border-b border-[#ebebeb]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JUCHEON" style={{ height: 90, width: "auto" }} />
        {onClose && (
          <button onClick={onClose} className="absolute right-4 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-2")}>
            {group.label && (
              <p className="px-5 py-1 text-[10px] font-semibold text-[#b0b0b8] uppercase tracking-wider">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href) ?? false;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 mx-2 text-sm font-medium transition-colors rounded-xl",
                    isActive
                      ? "text-[#3182f6] bg-[#3182f6]/10"
                      : "text-[#555] hover:text-[#191919] hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-[#ebebeb] hidden md:block z-30">
        <NavContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 bg-white rounded-xl shadow-sm p-2.5"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
      >
        <Menu className="w-4 h-4 text-[#191919]" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/25 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-60 bg-white shadow-xl z-50 md:hidden transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
