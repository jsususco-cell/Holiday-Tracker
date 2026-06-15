/**
 * Appends a flexi-holiday submission to the Google Sheet via a bound
 * Apps Script Web App (see google-apps-script/Code.gs).
 *
 * Set GOOGLE_SHEET_WEBHOOK_URL to the deployed web-app URL. Optionally set
 * GOOGLE_SHEET_WEBHOOK_SECRET to a shared secret the script also checks.
 */

export type SheetRow = {
  dateOfFiling: string; // YYYY-MM-DD
  holidayType: string; // "Regular Holiday" | "Special Non-Working Holiday"
  holidayName: string;
  employeeName: string;
  employeeEmail: string;
  action: string; // "Take Day Off" | "Report to Work"
  workBenefit: string; // "" | "Double Pay" | "Earn Holiday Credit"
  useFlexiCredit: string; // "Yes" | "No"
  fromDate: string;
  toDate: string;
  notes: string;
};

export async function appendToSheet(row: SheetRow): Promise<void> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "Missing GOOGLE_SHEET_WEBHOOK_URL. Deploy google-apps-script/Code.gs as a Web App and set the URL.",
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.GOOGLE_SHEET_WEBHOOK_SECRET || "",
      row,
    }),
    cache: "no-store",
    redirect: "follow",
  });

  // Apps Script returns 200 with a small JSON body on success.
  const text = await res.text();
  let parsed: { ok?: boolean; error?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON (e.g. an auth/redirect HTML page) */
  }

  if (!res.ok || parsed.ok === false) {
    throw new Error(
      `Sheet append failed (${res.status}): ${parsed.error || text.slice(0, 200)}`,
    );
  }
}
