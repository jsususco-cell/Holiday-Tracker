#!/usr/bin/env node
/**
 * One-time helper: exchange a Self Client GRANT code for a long-lived
 * REFRESH token, then print it so you can paste it into .env.local.
 *
 * Steps (do these first, in a browser):
 *  1. Go to https://api-console.zoho.com  →  "Self Client"  →  Create.
 *  2. Copy the Client ID and Client Secret into .env.local.
 *  3. In the Self Client "Generate Code" tab, enter scope:
 *       ZohoPeople.forms.ALL,ZohoPeople.leave.ALL
 *     pick a time duration, and Create. Copy the generated code (grant token).
 *  4. Run:  node scripts/get-refresh-token.mjs <THE_CODE>
 *
 * Reads ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_ACCOUNTS_DOMAIN from
 * .env.local (or the environment).
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
    /* no .env.local — rely on real environment */
  }
}

loadEnvLocal();

const code = process.argv[2];
if (!code) {
  console.error("Usage: node scripts/get-refresh-token.mjs <GRANT_CODE>");
  process.exit(1);
}

const accounts = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

const params = new URLSearchParams({
  grant_type: "authorization_code",
  client_id: clientId,
  client_secret: clientSecret,
  code,
});

const res = await fetch(`${accounts}/oauth/v2/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: params.toString(),
});
const data = await res.json();

if (!res.ok || !data.refresh_token) {
  console.error("Failed to get refresh token:");
  console.error(JSON.stringify(data, null, 2));
  console.error(
    "\nCommon causes: the grant code expired (they last only minutes — generate a fresh one), " +
      "wrong datacenter domain, or the code was already used once.",
  );
  process.exit(1);
}

console.log("\n✅ Success. Add this line to your .env.local:\n");
console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}\n`);
console.log("(Access token also returned, valid ~1h — the app refreshes it automatically.)");
