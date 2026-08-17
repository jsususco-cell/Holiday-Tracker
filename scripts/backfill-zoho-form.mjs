#!/usr/bin/env node
/**
 * One-off backfill: copy existing Flexi Holiday submissions from the Google
 * Sheet into the Zoho People "Flexi Holiday" custom form.
 *
 * Needed because filings made before the Zoho-form integration existed only in
 * the sheet. Safe to re-run: it skips anything already in Zoho.
 *
 * The sheet does NOT store the employee's email, so employees are matched by
 * name against Zoho People. Any name that doesn't resolve to exactly one active
 * employee is reported and skipped rather than guessed at.
 *
 * Usage:
 *   node scripts/backfill-zoho-form.mjs            # dry run (default)
 *   node scripts/backfill-zoho-form.mjs --commit   # actually insert
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");
const ADMIN = process.env.BACKFILL_ADMIN_EMAIL || "admin@byrdsonservices.com";
const APP = process.env.BACKFILL_APP_URL || "https://flexi-holiday-tracker.vercel.app";

for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const ACCOUNTS = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const PEOPLE = process.env.ZOHO_PEOPLE_DOMAIN || "https://people.zoho.com";
const FORM = process.env.ZOHO_FLEXI_FORM_LINKNAME || "flexi_holiday";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const toZohoDate = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}-${MONTHS[m - 1]}-${y}`;
};
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

async function token() {
  const p = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const j = await (await fetch(`${ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  })).json();
  if (!j.access_token) throw new Error("token refresh failed: " + JSON.stringify(j));
  return { Authorization: `Zoho-oauthtoken ${j.access_token}` };
}

const H = await token();

// 1) submissions from the sheet (via the app's admin API)
const subsRes = await fetch(`${APP}/api/admin/submissions?email=${encodeURIComponent(ADMIN)}`);
const subs = await subsRes.json();
if (!subs.ok) throw new Error("could not read submissions: " + subs.error);

// 2) active Zoho employees, for name -> employee code
const eu = new URL(`${PEOPLE}/people/api/forms/employee/getRecords`);
eu.searchParams.set("sIndex", "1");
eu.searchParams.set("rec_limit", "200");
const ej = await (await fetch(eu, { headers: H })).json();
const emps = [];
for (const row of ej?.response?.result || []) {
  for (const v of Object.values(row)) {
    const f = Array.isArray(v) ? v[0] : v;
    if (!f?.EmailID) continue;
    const status = String(f.Employeestatus || "").toUpperCase();
    if (status && status !== "ACTIVE") continue;
    emps.push({ code: f.EmployeeID, name: [f.FirstName, f.LastName].filter(Boolean).join(" ").trim() });
  }
}

// 3) what's already in Zoho, so re-runs don't duplicate
const zj = await (await fetch(`${PEOPLE}/people/api/forms/${FORM}/getRecords?sIndex=1&rec_limit=200`, { headers: H })).json();
const existing = new Set();
for (const row of zj?.response?.result || []) {
  const id = Object.keys(row)[0];
  const f = Array.isArray(row[id]) ? row[id][0] : row[id];
  existing.add([f.employee_id, f.holiday_date, f.action].join("|"));
}
console.log(`sheet: ${subs.rows.length} submission(s) | already in Zoho: ${existing.size}\n`);

let inserted = 0, skipped = 0, failed = 0;
for (const r of subs.rows) {
  const matches = emps.filter((e) => norm(e.name) === norm(r.employeeName));
  if (matches.length !== 1) {
    console.log(`  SKIP   ${r.employeeName} — ${matches.length === 0 ? "no active Zoho match" : "ambiguous name"}`);
    skipped++;
    continue;
  }
  const code = matches[0].code;
  const key = [code, toZohoDate(r.fromDate), r.action].join("|");
  if (existing.has(key)) {
    console.log(`  EXISTS ${r.employeeName} · ${r.holidayName} · ${r.fromDate}`);
    skipped++;
    continue;
  }

  const inputData = {
    employee_id: code,
    employee_name: r.employeeName,
    date_applied: toZohoDate(r.dateOfFiling),
    holiday_name: r.holidayName,
    holiday_date: toZohoDate(r.fromDate),
    holiday_type: r.holidayType,
    action: r.action,
    ...(r.benefit ? { benefit: r.benefit } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
  };

  if (!COMMIT) {
    console.log(`  WOULD  ${String(r.employeeName).padEnd(20)} ${String(r.holidayName).padEnd(20)} ${r.fromDate}  ${r.action}${r.benefit ? " / " + r.benefit : ""}`);
    inserted++;
    continue;
  }

  const res = await fetch(`${PEOPLE}/people/api/forms/json/${FORM}/insertRecord`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ inputData: JSON.stringify(inputData) }).toString(),
  });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch { /* non-JSON */ }
  // Zoho answers 200 with status:1 + errors on failure — check the body.
  if (body?.response?.errors || !res.ok) {
    console.log(`  FAIL   ${r.employeeName} · ${r.holidayName} -> ${JSON.stringify(body?.response?.errors || text.slice(0, 120))}`);
    failed++;
  } else {
    console.log(`  ADDED  ${String(r.employeeName).padEnd(20)} ${String(r.holidayName).padEnd(20)} ${r.fromDate}  (id ${body?.response?.result?.pkId || "?"})`);
    existing.add(key);
    inserted++;
  }
}

console.log(
  `\n${COMMIT ? "inserted" : "would insert"}: ${inserted} | skipped: ${skipped} | failed: ${failed}` +
  (COMMIT ? "" : "\n(dry run — re-run with --commit to write)"),
);
