import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

interface Ticker { ticker: string; name: string; }

let _cache: { tickers: Ticker[]; ts: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function runPython(): Promise<Ticker[]> {
  return new Promise((resolve, reject) => {
    const script = path.join(process.cwd(), "scripts", "get_tickers.py");
    // .env.local의 PYTHON_PATH 사용, 없으면 python3 → python 순 시도
    const pythonExe = process.env.PYTHON_PATH ?? "python";

    const proc = spawn(pythonExe, [script], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUTF8: "1",          // UTF-8 강제 (Python 3.7+)
        PYTHONIOENCODING: "utf-8",
      },
    });

    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString("utf8"); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString("utf8"); });

    proc.on("error", (e) => reject(new Error(`Python 시작 실패: ${e.message}`)));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || `Python exit code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error("JSON 파싱 실패: " + out.slice(0, 200)));
      }
    });
  });
}

export async function GET(req: NextRequest) {
  const count = parseInt(req.nextUrl.searchParams.get("count") ?? "200");
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  try {
    if (!_cache || refresh || Date.now() - _cache.ts > CACHE_TTL) {
      const tickers = await runPython();
      _cache = { tickers, ts: Date.now() };
    }
    return NextResponse.json({
      tickers: _cache.tickers.slice(0, count),
      total: _cache.tickers.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
