import { NextRequest, NextResponse } from "next/server";
import { appendToSheet, type SheetRow } from "@/lib/sheet";
import { creditLeaveBalance, resolveEmployee } from "@/lib/zoho";
import {
  ACTION_LABELS,
  HOLIDAY_TYPE_LABELS,
  WORK_BENEFIT_LABELS,
  earnsHolidayCredit,
  isAction,
  isHolidayType,
  isWorkBenefit,
  ACTIONS,
  type Action,
  type HolidayType,
  type WorkBenefit,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

type Payload = {
  holidayType?: string;
  dateOfFiling?: string;
  action?: string;
  workBenefit?: string; // only when action = report_to_work
  holidayName?: string;
  holidayDate?: string; // YYYY-MM-DD of the chosen holiday
  employeeName?: string;
  employeeEmail?: string;
  employeeId?: string; // numeric Zoho record id from sign-in (if known)
  notes?: string;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const holidayType = body.holidayType as HolidayType;
  const action = body.action as Action;
  const workBenefit = (body.workBenefit ?? "") as WorkBenefit | "";

  if (!isHolidayType(holidayType)) {
    return NextResponse.json({ ok: false, error: "Choose a holiday type." }, { status: 400 });
  }
  if (!isAction(action)) {
    return NextResponse.json({ ok: false, error: "Choose an action." }, { status: 400 });
  }
  if (action === ACTIONS.REPORT_TO_WORK && !isWorkBenefit(workBenefit)) {
    return NextResponse.json(
      { ok: false, error: "Choose Double Pay or Earn Holiday Credit." },
      { status: 400 },
    );
  }
  if (!body.employeeEmail) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 400 });
  }
  if (!body.holidayName || !body.holidayDate) {
    return NextResponse.json({ ok: false, error: "Choose a holiday." }, { status: 400 });
  }

  const wantsCredit = earnsHolidayCredit(action, workBenefit);
  // None of the current actions *use* a flexi-holiday credit:
  //  - Take Day Off  = not reporting to work (no credit drawn)
  //  - Report to Work = either Double Pay or Earn Credit (earns, not uses)
  // So this column is always "No" from this form.

  const row: SheetRow = {
    dateOfFiling: body.dateOfFiling || new Date().toISOString().slice(0, 10),
    holidayType: HOLIDAY_TYPE_LABELS[holidayType],
    holidayName: body.holidayName,
    employeeName: body.employeeName || "",
    employeeEmail: body.employeeEmail,
    action: ACTION_LABELS[action],
    workBenefit: workBenefit ? WORK_BENEFIT_LABELS[workBenefit as WorkBenefit] : "",
    useFlexiCredit: "No",
    fromDate: body.holidayDate,
    toDate: body.holidayDate,
    notes: body.notes || "",
  };

  // 1) Always log to the spreadsheet.
  try {
    await appendToSheet(row);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Spreadsheet update failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // 2) If earning a holiday credit, credit the "Holiday Leave Credits" balance.
  let zoho: { ok: boolean; detail?: unknown; error?: string } | null = null;
  if (wantsCredit) {
    try {
      const leaveTypeId = process.env.ZOHO_LEAVETYPE_HOLIDAY_CREDIT_ID;
      if (!leaveTypeId) {
        throw new Error("ZOHO_LEAVETYPE_HOLIDAY_CREDIT_ID is not configured.");
      }
      const hoursPerCredit = Number(process.env.HOLIDAY_CREDIT_HOURS || "8");

      let employeeId = body.employeeId;
      if (!employeeId) {
        const emp = await resolveEmployee(body.employeeEmail);
        if (!emp) throw new Error("Could not resolve Zoho employee id from email.");
        employeeId = emp.id;
      }
      const detail = await creditLeaveBalance({
        employeeId,
        leaveTypeId,
        count: hoursPerCredit,
        effectiveISO: body.holidayDate,
      });
      zoho = { ok: true, detail };
    } catch (err) {
      // The sheet row is already saved; report the Zoho failure without losing it.
      zoho = { ok: false, error: (err as Error).message };
    }
  }

  return NextResponse.json({
    ok: true,
    sheet: { ok: true },
    zoho,
    creditEarned: wantsCredit,
  });
}
