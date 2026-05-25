import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const data = await kisGet(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: ticker },
      "FHKST01010100"
    );
    const o = data.output;
    if (!o) return NextResponse.json({ error: "no data" }, { status: 404 });

    const sign = o.prdy_vrss_sign;
    const change = parseFloat(o.prdy_vrss ?? "0");
    const rate = parseFloat(o.prdy_ctrt ?? "0");

    return NextResponse.json({
      ticker,
      price: parseInt(o.stck_prpr ?? "0", 10),
      change: sign === "4" || sign === "5" ? -Math.abs(change) : Math.abs(change),
      rate: sign === "4" || sign === "5" ? -Math.abs(rate) : Math.abs(rate),
      volume: parseInt(o.acml_vol ?? "0", 10),
      high: parseInt(o.stck_hgpr ?? "0", 10),
      low: parseInt(o.stck_lwpr ?? "0", 10),
      open: parseInt(o.stck_oprc ?? "0", 10),
      per: parseFloat(o.per ?? "0"),
      pbr: parseFloat(o.pbr ?? "0"),
      w52High: parseInt(o.d250_hgpr ?? "0", 10),
      w52Low: parseInt(o.d250_lwpr ?? "0", 10),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
