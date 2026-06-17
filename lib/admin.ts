/**
 * Admin allowlist for manual credit approval.
 * Set ADMIN_EMAILS to a comma-separated list of Zoho emails allowed to approve.
 *
 * Note: this trusts the email the client supplies (same model as the rest of
 * the app, which verifies emails against Zoho but has no password/OAuth login).
 * For stronger guarantees, front this with real SSO.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function checkAdmin(
  email?: string | null,
): { ok: true } | { ok: false; status: number; error: string } {
  const list = adminEmails();
  if (!list.length) {
    return { ok: false, status: 500, error: "ADMIN_EMAILS is not configured." };
  }
  if (!email) return { ok: false, status: 400, error: "Email required." };
  if (!list.includes(email.toLowerCase())) {
    return { ok: false, status: 403, error: "This email is not authorized to approve credits." };
  }
  return { ok: true };
}
