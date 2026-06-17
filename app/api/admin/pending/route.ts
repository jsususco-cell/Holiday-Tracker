import { NextRequest, NextResponse } from "next/server";
import { listPendingCredits } from "@/lib/sheet";
import { checkAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/pending?email=<adminEmail> — list pending credits (admins only). */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const gate = checkAdmin(email);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  try {
    const rows = await listPendingCredits();
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      ok: true,
      rows: rows.map((r) => ({ ...r, passed: r.workedDate < today })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
