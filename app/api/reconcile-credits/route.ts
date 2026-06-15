import { NextRequest, NextResponse } from "next/server";
import {
  listPendingCredits,
  markPendingCredit,
  type PendingCredit,
} from "@/lib/sheet";
import { creditLeaveBalance, getWorkingHours } from "@/lib/zoho";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_HOURS = 8;

/**
 * Reconcile pending holiday credits.
 *
 * Posts a Holiday Leave Credit to Zoho for each pending request where:
 *   1. the holiday date has PASSED (workedDate < today), AND
 *   2. the employee's attendance that day was >= 8 hours.
 *
 * Runs daily via Vercel Cron (see vercel.json). Secured by CRON_SECRET:
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; manual calls may pass
 * `?key=<CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const leaveTypeId = process.env.ZOHO_LEAVETYPE_HOLIDAY_CREDIT_ID;
  if (!leaveTypeId) {
    return NextResponse.json(
      { ok: false, error: "ZOHO_LEAVETYPE_HOLIDAY_CREDIT_ID is not configured." },
      { status: 500 },
    );
  }
  const creditHours = Number(process.env.HOLIDAY_CREDIT_HOURS || "8");
  const todayISO = new Date().toISOString().slice(0, 10);

  let pending: PendingCredit[];
  try {
    pending = await listPendingCredits();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }

  const credited: string[] = [];
  const waiting: Array<{ key: string; reason: string }> = [];
  const errors: Array<{ key: string; error: string }> = [];

  for (const p of pending) {
    // Gate 1: holiday must have passed.
    if (p.workedDate >= todayISO) {
      waiting.push({ key: p.key, reason: "holiday not passed yet" });
      continue;
    }
    try {
      // Gate 2: attendance >= 8h that day.
      const hours = await getWorkingHours(p.employeeId, p.workedDate);
      if (hours < MIN_HOURS) {
        waiting.push({ key: p.key, reason: `attendance ${hours.toFixed(2)}h < ${MIN_HOURS}h` });
        continue;
      }
      await creditLeaveBalance({
        employeeId: p.employeeId,
        leaveTypeId,
        count: creditHours,
        effectiveISO: p.workedDate,
      });
      await markPendingCredit(
        p.key,
        "CREDITED",
        `attendance ${hours.toFixed(2)}h → +${creditHours}h on ${todayISO}`,
      );
      credited.push(p.key);
    } catch (err) {
      errors.push({ key: p.key, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: todayISO,
    counts: {
      pending: pending.length,
      credited: credited.length,
      waiting: waiting.length,
      errors: errors.length,
    },
    credited,
    waiting,
    errors,
  });
}
