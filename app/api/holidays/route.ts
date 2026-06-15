import { NextRequest, NextResponse } from "next/server";
import { getPHHolidays } from "@/lib/holidays";

export const dynamic = "force-dynamic";

/** GET /api/holidays?year=2026 — Philippine public holidays for the year. */
export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam
    ? parseInt(yearParam, 10)
    : new Date().getFullYear();

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { ok: false, error: "Invalid ?year" },
      { status: 400 },
    );
  }

  try {
    const holidays = await getPHHolidays(year);
    return NextResponse.json({ ok: true, year, holidays });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
