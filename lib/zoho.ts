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
