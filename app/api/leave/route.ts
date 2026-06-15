import { NextRequest, NextResponse } from "next/server";
import { insertLeave } from "@/lib/zoho";
import { isWriteAction, leavetypeForAction, ACTION_LABELS } from "@/lib/leave-map";

export const dynamic = "force-dynamic";

type Payload = {
  action?: string;
  email?: string;
  employeeName?: string;
  holidayName?: string;
  benefit?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  notes?: string;
  halfDaySession?: 1 | 2;
};

/** POST /api/leave — applies a holiday / credit record to Zoho People. */
export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { action, email, from, to } = body;

  if (!action || !isWriteAction(action)) {
    return NextResponse.json(
      { ok: false, error: "Unknown or non-write action" },
      { status: 400 },
    );
  }
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required" },
      { status: 400 },
    );
  }
  if (!from || !to) {
    return NextResponse.json(
      { ok: false, error: "From and To dates are required" },
      { status: 400 },
    );
  }

  const leavetypeId = leavetypeForAction(action);
  if (!leavetypeId) {
    return NextResponse.json(
      {
        ok: false,
        error: `No Zoho Leavetype configured for "${ACTION_LABELS[action]}". Set the matching ZOHO_LEAVETYPE_* env var.`,
      },
      { status: 500 },
    );
  }

  // Combine the descriptive form fields into the leave reason/notes.
  const reasonParts = [
    body.holidayName && `Holiday: ${body.holidayName}`,
    body.benefit && `Benefit: ${body.benefit}`,
    body.notes && body.notes.trim(),
  ].filter(Boolean);

  try {
    const result = await insertLeave({
      employeeId: email,
      leavetypeId,
      fromISO: from,
      toISO: to,
      reason: reasonParts.join(" — ") || undefined,
      halfDaySession: body.halfDaySession,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
