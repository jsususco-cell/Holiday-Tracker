import { NextRequest, NextResponse } from "next/server";
import { getPHHolidays, availableYears, type HolidayType } from "@/lib/holidays";

export const dynamic = "force-dynamic";

/**
 * GET /api/holidays?year=2026&type=regular
 *   - type: "regular" | "special" (omit for all)
 * Returns the Official-Gazette-classified PH holidays for that year/type.
 */
export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const typeParam = req.nextUrl.searchParams.get("type");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ ok: false, error: "Invalid ?year" }, { status: 400 });
  }

  let type: HolidayType | undefined;
  if (typeParam === "regular" || typeParam === "special") {
    type = typeParam;
  } else if (typeParam) {
    return NextResponse.json(
      { ok: false, error: "type must be 'regular' or 'special'" },
      { status: 400 },
    );
  }

  const holidays = getPHHolidays(year, type);
  return NextResponse.json({ ok: true, year, type: type ?? null, years: availableYears(), holidays });
}
