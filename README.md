# Byrdson — Flexi Holiday → Google Sheet + Zoho People

A standalone form for filing Philippine holidays. Employees sign in with their
Zoho email, choose a holiday and an action, and the submission is logged to the
Holiday Tracker Google Sheet. When they work a holiday and elect to **earn a
holiday credit**, a **Compensatory-Off** credit is also written to Zoho People.

All secrets (Zoho client secret / refresh token, the sheet webhook URL) live
**server-side only** in Next.js route handlers. The browser never sees them.

## Workflow

```
1. Sign in        enter Zoho email → /api/me verifies it & pre-fills name + id
2. Pick view      Regular Holiday  |  Special Non-Working Holiday   (tabs)
3. Fill form
     Date of Filing
     Action ─┬─ Take Day Off ─────────────────────────────► sheet only
             └─ Report to Work ─┬─ Double Pay ──────────────► sheet only
                                └─ Earn Holiday Credit ─────► sheet + Zoho
     Holiday Name   ← dropdown from the PH public-holidays API (per year)
     Employee Name / Email   ← pre-filled from sign-in (read-only)
     Notes
4. Submit → append a row to the Google Sheet (Summary formulas roll up)
5. If "Earn Holiday Credit" → POST a Comp-Off credit to Zoho People
```

### How the credit maps to Zoho

The Summary sheet's **Accumulated / Used / Balance** columns are exactly Zoho
People's **Compensatory-Off** semantics:

| Sheet column | Driven by | Zoho |
|---|---|---|
| Accumulated Flexi-Holiday Credits | Report to Work → Earn Holiday Credit | Comp-Off **credit** (`POST /api/v3/leave-tracker/compensatory`) |
| Used Flexi-holiday credit | Take Day Off (drawing on a credit) | Comp-Off **availed** (logged to sheet; see note) |
| Balance | accumulated − used | Comp-Off balance |

> Per the current spec, **only "Earn Holiday Credit" writes to Zoho.** "Take Day
> Off" is logged to the sheet only. If you also want *using* a credit to draw
> down the Zoho Comp-Off balance, say so and we'll add the avail call.

## Architecture

```
Browser (app/page.tsx)
  │  /api/me        → verify email, pre-fill (lib/zoho.resolveEmployee)
  │  /api/holidays  → PH public holidays (lib/holidays → Nager.Date)
  │  /api/submit    → lib/sheet.appendToSheet  → Google Apps Script Web App
  │                   lib/zoho.addCompOff       → Zoho People (if earning credit)
  ▼
Google Sheet (Apps Script)            Zoho People (people.zoho.com)
```

## Setup

### A. Zoho OAuth (in a browser, as a Zoho admin)

1. **https://api-console.zoho.com → Add Client → Self Client → Create.** Copy
   the Client ID + Secret.
2. `cp .env.local.example .env.local` and paste them. Confirm the datacenter
   domains (`.com` for US).
3. Self Client → **Generate Code** tab, scope
   `ZohoPeople.forms.ALL,ZohoPeople.leave.ALL`, create, copy the code (expires
   in minutes), then:
   ```bash
   npm run zoho:token -- PASTE_THE_CODE
   ```
   Paste the printed `ZOHO_REFRESH_TOKEN=...` into `.env.local`.
4. Make sure **Compensatory Off** is enabled in Zoho People (Leave settings).
   Note: the integration uses the **v3** comp-off API with `dd-MMM-yyyy` dates
   (the v2 endpoint silently no-ops on this account). Adding the same worked
   date twice for an employee returns "Date is already added" — expected.

### B. Google Sheet receiver

Follow [`google-apps-script/README.md`](google-apps-script/README.md): paste
`Code.gs` into the sheet's Apps Script, deploy as a Web App, and put the URL in
`GOOGLE_SHEET_WEBHOOK_URL` (plus an optional shared secret).

### C. Run

```bash
npm install
npm run dev        # http://localhost:3010
```

## Deploy (Vercel)

Connect the GitHub repo in the Vercel dashboard, add the same env vars under
**Settings → Environment Variables**, deploy. Every push to `main` auto-deploys.

## Files

- `app/page.tsx` — sign-in + the two-view form
- `app/api/me/route.ts` — verify email, return employee name + id
- `app/api/holidays/route.ts` — PH public holidays for a year
- `app/api/submit/route.ts` — append to sheet + conditional Comp-Off
- `app/api/leave-types/route.ts` — (optional) balance lookup
- `lib/actions.ts` — action model + helpers
- `lib/holidays.ts` — Nager.Date PH holidays (cached)
- `lib/sheet.ts` — POST to the Apps Script web app
- `lib/zoho.ts` — OAuth refresh, employee lookup, Comp-Off, leave insert
- `google-apps-script/Code.gs` — the sheet receiver to deploy
- `scripts/get-refresh-token.mjs` — one-time refresh-token bootstrap
- `scripts/list-leave-types.mjs` — discover leave type IDs (diagnostics)
