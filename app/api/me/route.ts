import { NextRequest, NextResponse } from "next/server";
import { resolveEmployee } from "@/lib/zoho";
import { checkAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/me?email=...  — verifies the email belongs to a Zoho People
 * employee and returns their name + record id (used to pre-fill the form
 * and to attribute the comp-off credit).
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const employee = await resolveEmployee(email);
    if (!employee) {
      return NextResponse.json(
        { ok: false, error: "No Zoho People employee found for this email." },
        { status: 404 },
      );
    }
    const isAdmin = checkAdmin(employee.email).ok;
    return NextResponse.json({ ok: true, employee: { ...employee, isAdmin } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
