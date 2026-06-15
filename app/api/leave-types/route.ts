import { NextRequest, NextResponse } from "next/server";
import { getLeaveTypeDetails } from "@/lib/zoho";

export const dynamic = "force-dynamic";

/** GET /api/leave-types?email=someone@byrdsonservices.com */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Missing ?email" },
      { status: 400 },
    );
  }
  try {
    const types = await getLeaveTypeDetails(email);
    return NextResponse.json({ ok: true, types });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
