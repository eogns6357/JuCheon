import { NextRequest, NextResponse } from "next/server";
import { kisGet } from "@/lib/kis";
import { formatDate, kisDateToISO } from "@/lib/stocks";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 20);

    const data = await kisGet(
      "/uapi/domestic-stock/v1/quotations/inquire-investor",
      {
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD: ticker,
        FID_INPUT_DATE_1: formatDate(start),
        FID_INPUT_DATE_2: formatDate(end),
      },
      "FHKST01010900"
    );

    // KIS output2: newest-first → reverse to oldest-first
    const rows = ((data.output2 ?? []) as Record<string, string>[])
      .filter((r) => r.stck_bsop_date)
      .reverse()
      .map((r) => ({
        date: kisDateToISO(r.stck_bsop_date),
        foreignNet: parseInt(r.frgn_ntby_qty ?? "0", 10),
        instNet: parseInt(r.orgn_ntby_qty ?? "0", 10),
        foreignNetAmt: parseInt(r.frgn_ntby_tr_pbmn ?? "0", 10), // 백만원
        instNetAmt: parseInt(r.orgn_ntby_tr_pbmn ?? "0", 10),
      }));

    const last5 = rows.slice(-5);
    const foreign5d = last5.reduce((s, r) => s + r.foreignNet, 0);
    const inst5d = last5.reduce((s, r) => s + r.instNet, 0);

    return NextResponse.json({ rows, foreign5d, inst5d });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
