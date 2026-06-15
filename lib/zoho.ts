/**
 * Server-side Zoho People API client.
 *
 * Auth model: OAuth 2.0. We hold a long-lived REFRESH token (created once via
 * the Self Client flow — see scripts/get-refresh-token.mjs) and exchange it for
 * short-lived access tokens on demand, caching the access token in memory until
 * shortly before it expires.
 *
 * This module must only ever run on the server. The client secret and refresh
 * token must never reach the browser.
 */

const ACCOUNTS = () =>
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const PEOPLE = () =>
  process.env.ZOHO_PEOPLE_DOMAIN || "https://people.zoho.com";

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return v;
}

/** Returns a valid access token, refreshing if needed. */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const params = new URLSearchParams({
    refresh_token: requireEnv("ZOHO_REFRESH_TOKEN"),
    client_id: requireEnv("ZOHO_CLIENT_ID"),
    client_secret: requireEnv("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });

  const res = await fetch(`${ACCOUNTS()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Zoho token refresh failed: ${data.error || res.statusText}`,
    );
  }

  cached = {
    token: data.access_token,
    // expires_in is seconds (~3600). Cache slightly less.
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

async function zohoFetch(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<Response> {
  const token = await getAccessToken();
  const url = new URL(`${PEOPLE()}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  const { query: _q, ...rest } = init;
  void _q;
  return fetch(url.toString(), {
    ...rest,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(rest.headers || {}),
    },
    cache: "no-store",
  });
}

/** Format a JS Date or YYYY-MM-DD string into Zoho's DD-Mon-YYYY format. */
export function toZohoDate(input: string): string {
  // input expected as YYYY-MM-DD (from <input type="date">)
  const [y, m, d] = input.split("-").map((n) => parseInt(n, 10));
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (!y || !m || !d) throw new Error(`Invalid date: ${input}`);
  return `${String(d).padStart(2, "0")}-${months[m - 1]}-${y}`;
}

/** Inclusive list of YYYY-MM-DD dates between from and to. */
function eachDate(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const start = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    throw new Error("Invalid date range");
  }
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export type LeaveTypeDetail = {
  Name: string;
  Id: string;
  AvailableCount?: string;
  BookedCount?: string;
  [k: string]: unknown;
};

/** GET leave types + balances for an employee (by email or Employee_ID). */
export async function getLeaveTypeDetails(
  userId: string,
): Promise<LeaveTypeDetail[]> {
  const res = await zohoFetch("/people/api/leave/getLeaveTypeDetails", {
    method: "GET",
    query: { userId },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `getLeaveTypeDetails failed: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  // Zoho wraps the payload differently across accounts; normalise common shapes.
  const list =
    (data?.response?.result as LeaveTypeDetail[]) ||
    (data?.result as LeaveTypeDetail[]) ||
    (Array.isArray(data) ? (data as LeaveTypeDetail[]) : []);
  return list;
}

export type InsertLeaveInput = {
  employeeId: string; // Employee_ID or email
  leavetypeId: string;
  fromISO: string; // YYYY-MM-DD
  toISO: string; // YYYY-MM-DD
  reason?: string;
  /** Half day on a single date: session 1 = first half, 2 = second half. */
  halfDaySession?: 1 | 2;
};

/**
 * Insert a leave record via the forms insertRecord API.
 * Builds the `days` object Zoho requires (full days unless a half-day session
 * is specified on a single-date request).
 */
export async function insertLeave(input: InsertLeaveInput): Promise<unknown> {
  const formLinkName = process.env.ZOHO_LEAVE_FORM_LINKNAME || "leave";
  const reasonField = process.env.ZOHO_LEAVE_REASON_FIELD || "Reasonforleave";

  const dates = eachDate(input.fromISO, input.toISO);
  const days: Record<string, { LeaveCount: number; Session?: number }> = {};
  for (const iso of dates) {
    const zd = toZohoDate(iso);
    if (input.halfDaySession && dates.length === 1) {
      days[zd] = { LeaveCount: 0.5, Session: input.halfDaySession };
    } else {
      days[zd] = { LeaveCount: 1 };
    }
  }

  const inputData: Record<string, unknown> = {
    Employee_ID: input.employeeId,
    Leavetype: input.leavetypeId,
    From: toZohoDate(input.fromISO),
    To: toZohoDate(input.toISO),
    days,
  };
  if (input.reason) inputData[reasonField] = input.reason;

  const res = await zohoFetch(
    `/people/api/forms/json/${formLinkName}/insertRecord`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        inputData: JSON.stringify(inputData),
      }).toString(),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`insertLeave failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

/* ────────────────────────────────────────────────────────────────────────
 * Employee lookup
 * ──────────────────────────────────────────────────────────────────────── */

export type ZohoEmployee = {
  id: string; // numeric record id (used by the comp-off API's `employee` field)
  name: string;
  email: string;
};

/**
 * Resolve a Zoho People employee by email. Used for sign-in verification and
 * to get the numeric record id required by the comp-off API.
 *
 * Implementation note: field/view names vary per Zoho account. This uses the
 * Employee form fetchRecords search; override the searchable field name via
 * ZOHO_EMP_EMAIL_FIELD if your account differs (default "EmailID").
 */
export async function resolveEmployee(
  email: string,
): Promise<ZohoEmployee | null> {
  const emailField = process.env.ZOHO_EMP_EMAIL_FIELD || "EmailID";
  const searchParams = JSON.stringify({
    searchField: emailField,
    searchOperator: "Is",
    searchText: email,
  });

  const res = await zohoFetch("/people/api/forms/employee/getRecords", {
    method: "GET",
    query: { searchParams, sIndex: "1", rec_limit: "1" },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `resolveEmployee failed: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  // Zoho returns a nested {response:{result:[{<recordId>:[{...fields...}]}]}}
  // shape that varies; dig out the first record defensively.
  const result =
    data?.response?.result ?? data?.result ?? (Array.isArray(data) ? data : null);
  const record = extractFirstEmployeeRecord(result);
  if (!record) return null;
  return record;
}

function extractFirstEmployeeRecord(result: unknown): ZohoEmployee | null {
  if (!result) return null;

  // Common shape: [{ "<recordId>": [ { FirstName, LastName, EmailID, ... } ] }]
  const rows = Array.isArray(result) ? result : [result];
  for (const row of rows) {
    if (row && typeof row === "object") {
      for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
        const fields = Array.isArray(val) ? val[0] : val;
        if (fields && typeof fields === "object") {
          const f = fields as Record<string, string>;
          const name =
            [f.FirstName, f.LastName].filter(Boolean).join(" ").trim() ||
            f.EmployeeName ||
            f.FullName ||
            "";
          // IMPORTANT: the record's string key is the Zoho record id with full
          // precision. f.Zoho_ID is a JSON number and loses precision beyond
          // 2^53, so never use it for the id — prefer the key.
          const id = /^\d{6,}$/.test(key)
            ? key
            : f.recordId || f.EmployeeID || String(f.Zoho_ID || "");
          const mail = f.EmailID || f.EmailId || f.Email || "";
          if (id) return { id: String(id), name, email: mail };
        }
      }
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────
 * Holiday Leave Credit (credit a leave-type balance)
 * ──────────────────────────────────────────────────────────────────────── */

export type CreditLeaveInput = {
  employeeId: string; // numeric Zoho record id (EmpErecno)
  leaveTypeId: string; // the leave type to credit (e.g. "Holiday Leave Credits")
  count: number; // amount in the leave type's unit (Hours here); +adds, -subtracts
  effectiveISO: string; // YYYY-MM-DD the credit applies on (the worked date)
};

/**
 * Credit (or debit) an employee's balance for a specific leave type.
 *
 * POST /people/api/leave/addBalance?balanceData=...&dateFormat=dd-MMM-yyyy
 * (scope ZohoPeople.leave.ALL). This is how "Earn Holiday Credit" raises the
 * "Holiday Leave Credits" Available balance — NOT the Compensatory-Off module.
 *
 * NOTE: addBalance is not idempotent — it has no per-date dedupe, so calling it
 * twice for the same worked date credits twice. Guard against double-submits at
 * the caller if needed.
 */
export async function creditLeaveBalance(
  input: CreditLeaveInput,
): Promise<{ addedCount: number; errorCount: number }> {
  const date = toZohoDate(input.effectiveISO); // dd-MMM-yyyy
  const balanceData = JSON.stringify({
    [input.employeeId]: {
      [input.leaveTypeId]: { date, count: String(input.count) },
    },
  });

  const res = await zohoFetch("/people/api/leave/addBalance", {
    method: "POST",
    query: { balanceData, dateFormat: "dd-MMM-yyyy" },
  });

  const text = await res.text();
  let data: {
    response?: {
      result?: { addedCount?: number; errorCount?: number };
      status?: number;
      message?: string;
    };
  } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON */
  }

  const result = data.response?.result;
  const added = result?.addedCount ?? 0;
  const errors = result?.errorCount ?? 0;
  if (!res.ok || added < 1 || errors > 0) {
    throw new Error(
      `creditLeaveBalance failed (${res.status}): ${data.response?.message || text.slice(0, 200) || "no records added"}`,
    );
  }
  return { addedCount: added, errorCount: errors };
}
