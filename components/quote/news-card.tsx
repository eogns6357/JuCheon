"use client";

import Image from "next/image";
import { Newspaper } from "lucide-react";

export interface NewsCardItem {
  id: string;
  title: string;
  source: string;
  date: string;
  time: string;
  url?: string;
  imageUrl?: string;
}

function formatWhen(date: string, time: string) {
  return [date, time].filter(Boolean).join(" ");
}

function NewsCardPlaceholder({ source }: { source: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#e8eef8] to-[#f0f0f5] text-[#b0b0b8]">
      <Newspaper className="w-5 h-5 mb-0.5 opacity-60" strokeWidth={1.5} />
      <span className="text-[9px] font-medium px-1 text-center line-clamp-1">{source}</span>
    </div>
  );
}

export function NewsCard({ item }: { item: NewsCardItem }) {
  const when = formatWhen(item.date, item.time);
  const inner = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f0f0f5]">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <NewsCardPlaceholder source={item.source} />
        )}
      </div>
      <div className="p-2 flex flex-col gap-0.5">
        <h4 className="text-[11px] font-semibold text-[#191919] leading-tight line-clamp-2 group-hover:text-[#3182f6] transition-colors">
          {item.title}
        </h4>
        <p className="text-[9px] text-[#b0b0b8] truncate">
          {item.source}
          {when && (
            <>
              <span className="mx-1">·</span>
              <span className="num">{when}</span>
            </>
          )}
        </p>
      </div>
    </>
  );

  const className =
    "group block rounded-xl overflow-hidden bg-white border border-[#f0f0f5] shadow-sm hover:shadow-md transition-shadow";

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return <article className={className}>{inner}</article>;
}

export function NewsCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-[#f0f0f5] shadow-sm animate-pulse">
      <div className="aspect-[4/3] bg-[#f0f0f5]" />
      <div className="p-2 space-y-1.5">
        <div className="h-2.5 bg-[#f0f0f5] rounded w-full" />
        <div className="h-2.5 bg-[#f0f0f5] rounded w-4/5" />
        <div className="h-2 bg-[#f0f0f5] rounded w-1/2" />
      </div>
    </div>
  );
}
