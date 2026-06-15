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

/* ── Pending-credit queue (PendingCredits tab) ── */

function webhookUrl(): string {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) throw new Error("Missing GOOGLE_SHEET_WEBHOOK_URL.");
  return url;
}
const SECRET = () => process.env.GOOGLE_SHEET_WEBHOOK_SECRET || "";

export type PendingCredit = {
  key: string; // unique: `${employeeId}__${workedDate}`
  workedDate: string; // YYYY-MM-DD
  employeeId: string; // Zoho erecno
  employeeEmail: string;
  employeeName: string;
  holidayName: string;
  hours: number;
};

async function postWebhook(payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(webhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SECRET(), ...payload }),
    cache: "no-store",
    redirect: "follow",
  });
  const text = await res.text();
  let parsed: { ok?: boolean; error?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok || parsed.ok === false) {
    throw new Error(`Webhook failed (${res.status}): ${parsed.error || text.slice(0, 200)}`);
  }
  return parsed;
}

/** Register a holiday credit to be posted later (idempotent by key). */
export async function registerPendingCredit(p: PendingCredit): Promise<void> {
  await postWebhook({ kind: "pending", pending: p });
}

/** List all PENDING credit rows from the sheet. */
export async function listPendingCredits(): Promise<PendingCredit[]> {
  const url = new URL(webhookUrl());
  url.searchParams.set("action", "pending");
  url.searchParams.set("secret", SECRET());
  const res = await fetch(url.toString(), { cache: "no-store", redirect: "follow" });
  const text = await res.text();
  let parsed: { ok?: boolean; rows?: PendingCredit[]; error?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok || parsed.ok === false) {
    throw new Error(`List pending failed (${res.status}): ${parsed.error || text.slice(0, 200)}`);
  }
  return parsed.rows || [];
}

/** Mark a pending credit row (CREDITED / NO_CREDIT / …) with a note. */
export async function markPendingCredit(
  key: string,
  status: string,
  note: string,
): Promise<void> {
  await postWebhook({ kind: "mark", key, status, note });
}
