/**
 * Google AI (v1beta) generateContent — 품질 높은 순 폴백.
 * GEMINI_MODEL=gemini-2.5-pro,gemini-2.5-flash,... 로 덮어쓸 수 있음.
 */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

export function resolveGeminiModels(): string[] {
  const raw = process.env.GEMINI_MODEL?.trim();
  if (raw) {
    return raw.split(",").map((m) => m.trim()).filter(Boolean);
  }
  return [...GEMINI_MODEL_FALLBACK_CHAIN];
}

export function isRetryableGeminiError(err: {
  code?: number;
  message?: string;
  status?: string;
}) {
  const msg = `${err.message ?? ""} ${err.status ?? ""}`.toLowerCase();
  if (err.code === 404 || err.code === 429 || err.code === 403 || err.code === 503) return true;
  return (
    msg.includes("not found") ||
    msg.includes("not supported") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("resource_exhausted") ||
    msg.includes("unavailable") ||
    msg.includes("try again")
  );
}
