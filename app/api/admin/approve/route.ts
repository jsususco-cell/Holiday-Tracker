import { NextRequest, NextResponse } from "next/server";
import { listPendingCredits, markPendingCredit } from "@/lib/sheet";
import { creditLeaveBalance } from "@/lib/zoho";
import { checkAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/approve  { email, key }
 * Manually approve a pending credit — posts the Holiday Leave Credit to Zoho
 * immediately, BYPASSING the date/attendance gates. Admins only.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const gate = checkAdmin(email);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  if (!body.key) {
    return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 });
  }

  const leaveTypeId = process.env.ZOHO_LEAVETYPE_HOLIDAY_CREDIT_ID;
  if (!leaveTypeId) {
    return NextResponse.json(
      { ok: false, error: "ZOHO_LEAVETYPE_HOLIDAY_CREDIT_ID is not configured." },
      { status: 500 },
    );
  }
  const creditHours = Number(process.env.HOLIDAY_CREDIT_HOURS || "8");

  try {
    const row = (await listPendingCredits()).find((r) => r.key === body.key);
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Pending credit not found (already processed?)." },
        { status: 404 },
      );
    }
    await creditLeaveBalance({
      employeeId: row.employeeId,
      leaveTypeId,
      count: creditHours,
      effectiveISO: row.workedDate,
    });
    await markPendingCredit(row.key, "CREDITED", `Manually approved by ${email}`);
    return NextResponse.json({
      ok: true,
      credited: { key: row.key, employee: row.employeeName, hours: creditHours },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
