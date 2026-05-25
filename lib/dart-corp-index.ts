import { inflateRawSync } from "zlib";
import { promises as fs } from "fs";
import path from "path";

const INDEX_PATH = path.join(process.cwd(), ".data", "dart-corp-index.json");
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

interface CorpIndexFile {
  savedAt: string;
  /** 6자리 종목코드 → DART corp_code */
  byStock: Record<string, string>;
}

let memoryIndex: CorpIndexFile | null = null;

/** DART corpCode.xml ZIP — 로컬 헤더 크기가 0이면 central directory 기준으로 해제 */
function unzipSingleXml(buffer: Buffer): string {
  const eocd = buffer.length - 22;
  if (buffer.readUInt32LE(eocd) !== 0x06054b50) {
    throw new Error("DART corpCode: ZIP 끝 레코드를 찾을 수 없습니다.");
  }

  const cdOffset = buffer.readUInt32LE(eocd + 16);
  const cd = buffer.subarray(cdOffset);
  if (cd.readUInt32LE(0) !== 0x02014b50) {
    throw new Error("DART corpCode: central directory가 없습니다.");
  }

  const method = cd.readUInt16LE(10);
  const compSize = cd.readUInt32LE(20);
  const localOffset = cd.readUInt32LE(42);
  const local = buffer.subarray(localOffset);
  if (local.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("DART corpCode: 로컬 파일 헤더가 없습니다.");
  }

  const dataStart = 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  const compressed = buffer.subarray(localOffset + dataStart, localOffset + dataStart + compSize);

  if (method === 0) return compressed.toString("utf8");
  if (method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`DART corpCode: 지원하지 않는 압축 방식 (${method})`);
}

function parseCorpXml(xml: string): Record<string, string> {
  const byStock: Record<string, string> = {};
  for (const block of xml.split("<list>").slice(1)) {
    const corpCode = block.match(/<corp_code>(\d+)<\/corp_code>/)?.[1];
    const stockCode = block.match(/<stock_code>(\d*)<\/stock_code>/)?.[1]?.trim();
    if (corpCode && stockCode?.length === 6) {
      byStock[stockCode] = corpCode;
    }
  }
  return byStock;
}

async function downloadCorpIndex(apiKey: string): Promise<CorpIndexFile> {
  const res = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) {
    throw new Error(`DART corpCode 다운로드 실패 (${res.status})`);
  }

  const xml = unzipSingleXml(Buffer.from(await res.arrayBuffer()));
  const byStock = parseCorpXml(xml);
  if (Object.keys(byStock).length === 0) {
    throw new Error("DART corpCode 파싱 결과가 비어 있습니다. API 키를 확인하세요.");
  }

  const file: CorpIndexFile = { savedAt: new Date().toISOString(), byStock };
  await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(file), "utf8");
  memoryIndex = file;
  return file;
}

async function loadCachedIndex(): Promise<CorpIndexFile | null> {
  if (memoryIndex) return memoryIndex;
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    const data = JSON.parse(raw) as CorpIndexFile;
    if (!data.byStock || !data.savedAt) return null;
    memoryIndex = data;
    return data;
  } catch {
    return null;
  }
}

export async function resolveDartCorpCode(ticker: string): Promise<string | null> {
  const key = process.env.DART_API_KEY?.trim();
  const stock = ticker.replace(/\D/g, "").padStart(6, "0").slice(-6);
  if (!key || stock.length !== 6) return null;

  const cached = await loadCachedIndex();
  const stale =
    !cached || Date.now() - new Date(cached.savedAt).getTime() > CACHE_MS;

  const index = stale ? await downloadCorpIndex(key) : cached;
  return index.byStock[stock] ?? null;
}
