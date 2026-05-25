import { promises as fs } from "fs";
import path from "path";
export interface MarketStock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  rate: number;
  volume: number;
  /** 당일 누적 거래대금 (원) */
  tradeValue: number;
}

export interface MoodData {
  volume30: MarketStock[];
  gainers: MarketStock[];
  losers: MarketStock[];
  stale?: boolean;
  savedAt?: string;
}

interface StoredSnapshot {
  volume30: MarketStock[];
  gainers: MarketStock[];
  losers: MarketStock[];
  savedAt: string;
}

const SNAPSHOT_PATH = path.join(process.cwd(), ".data", "market-mood.json");

export async function loadMoodSnapshot(): Promise<StoredSnapshot | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
    const data = JSON.parse(raw) as StoredSnapshot;
    if (!data.volume30?.length) return null;
    return {
      ...data,
      volume30: data.volume30.map((s) => ({
        ...s,
        tradeValue: s.tradeValue ?? 0,
      })),
    };
  } catch {
    return null;
  }
}

export async function saveMoodSnapshot(data: Omit<StoredSnapshot, "savedAt">): Promise<void> {
  if (!data.volume30.length) return;
  const payload: StoredSnapshot = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export function withStale(snapshot: StoredSnapshot): MoodData {
  return {
    volume30: snapshot.volume30,
    gainers: snapshot.gainers,
    losers: snapshot.losers,
    stale: true,
    savedAt: snapshot.savedAt,
  };
}
