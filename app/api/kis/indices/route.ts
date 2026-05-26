import { NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";

async function fetchIndex(code: string, name: string) {
  const data = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-index-price",
    { FID_COND_MRKT_DIV_CODE: "U", FID_INPUT_ISCD: code },
    "FHPUP02100000"
  );
  const o = data.output;
  const sign = o?.prdy_vrss_sign ?? "3";
  const raw = parseFloat(o?.bstp_nmix_prdy_ctrt ?? "0");
  return {
    name,
    value: parseFloat(o?.bstp_nmix_prpr ?? "0"),
    change: parseFloat(o?.bstp_nmix_prdy_vrss ?? "0") * (sign === "4" || sign === "5" ? -1 : 1),
    rate: raw * (sign === "4" || sign === "5" ? -1 : 1),
  };
}

export async function GET() {
  try {
    const [kospi, kosdaq] = await Promise.all([
      fetchIndex("0001", "KOSPI"),
      fetchIndex("1001", "KOSDAQ"),
    ]);
    return NextResponse.json({ kospi, kosdaq });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
