import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { DisclaimerModal } from "@/components/disclaimer-modal";

export const metadata: Metadata = {
  title: "개인 트레이더",
  description: "한국 주식 단기 매매 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-[#f0f0f5]">
        <DisclaimerModal />
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 min-h-full md:ml-60 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
