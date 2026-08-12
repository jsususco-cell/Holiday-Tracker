import { NextRequest, NextResponse } from "next/server";
import { listSubmissions } from "@/lib/sheet";
import { checkAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/submissions?email=<adminEmail>
 * Every filing from both sheet tabs, categorised for the admin view.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const gate = checkAdmin(email);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  try {
    const rows = await listSubmissions();
    const counts = {
      all: rows.length,
      earn_credit: rows.filter((r) => r.category === "earn_credit").length,
      double_pay: rows.filter((r) => r.category === "double_pay").length,
      take_day_off: rows.filter((r) => r.category === "take_day_off").length,
      report_to_work: rows.filter((r) => r.category === "report_to_work").length,
    };
    return NextResponse.json({ ok: true, counts, rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
