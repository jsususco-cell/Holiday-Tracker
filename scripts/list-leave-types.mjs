#!/usr/bin/env node
/**
 * Lists the Zoho People leave types (and their numeric IDs) for a given
 * employee, so you can fill in the ZOHO_LEAVETYPE_* env vars.
 *
 * Usage:  node scripts/list-leave-types.mjs someone@byrdsonservices.com
 *
 * Reads credentials from .env.local.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}
loadEnvLocal();

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/list-leave-types.mjs <employee-email>");
  process.exit(1);
}

const accounts = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const people = process.env.ZOHO_PEOPLE_DOMAIN || "https://people.zoho.com";

async function accessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Token refresh failed: " + JSON.stringify(data));
  }
  return data.access_token;
}

const token = await accessToken();
const url = new URL(`${people}/people/api/leave/getLeaveTypeDetails`);
url.searchParams.set("userId", userId);

const res = await fetch(url, {
  headers: { Authorization: `Zoho-oauthtoken ${token}` },
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
console.log(
  "\nLook for each leave type's Id and copy the relevant ones into the ZOHO_LEAVETYPE_* env vars.",
);
