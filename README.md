# Byrdson — Flexi Holiday → Zoho People

A standalone form + thin server API that lets employees apply holidays, use
holiday credit, credit a worked holiday, or view their balances — writing
directly to the **real** Zoho People account (`byrdsonservicesllc`) over its
REST API.

The Zoho client secret and refresh token live **server-side only** (in API
routes). The browser never sees them.

## Architecture

```
Browser form (app/page.tsx)
      │  fetch
      ▼
/api/leave        ──┐
/api/leave-types  ──┤  Next.js route handlers (server)
                    │  lib/zoho.ts: refresh token → access token → Zoho API
                    ▼
            Zoho People (people.zoho.com)
```

The form has **two views** (tabs), matching the two source forms:

- **Regular Holiday** (`/flexi-holiday`) — paid even if unworked; 200% if worked.
- **Special Non-Working Holiday** (`/Non-working`) — no-work-no-pay; 130% if worked.

Each view maps its actions to its own set of Zoho leave types:

| View | Form action | Zoho call → env var |
|---|---|---|
| Regular | Apply / take a holiday off | `insertRecord` → `ZOHO_LEAVETYPE_HOLIDAY` |
| Regular | Use holiday credit | `insertRecord` → `ZOHO_LEAVETYPE_HOLIDAY_CREDIT` |
| Regular | Credit a worked holiday | `insertRecord` → `ZOHO_LEAVETYPE_WORKED_HOLIDAY` |
| Special | Apply / take a holiday off | `insertRecord` → `ZOHO_LEAVETYPE_SPECIAL_HOLIDAY` |
| Special | Use holiday credit | `insertRecord` → `ZOHO_LEAVETYPE_SPECIAL_HOLIDAY_CREDIT` |
| Special | Credit a worked holiday | `insertRecord` → `ZOHO_LEAVETYPE_SPECIAL_WORKED_HOLIDAY` |
| either | Just show my balances | `getLeaveTypeDetails` |

The Special view hides the **Benefit** field and relabels "Holiday Name" →
"Non-Working Holiday Name", matching the source form.

> Note on "credit": Zoho People exposes no clean public "adjust balance"
> endpoint, so each action maps to a leave record against a dedicated leave
> type you configure. If your accrual model needs a different mechanism (e.g.
> Comp-off), adjust `lib/leave-map.ts` and `lib/zoho.ts` accordingly.

## One-time Zoho setup (do this in a browser, logged in as a Zoho admin)

### 1. Create a Self Client

1. Go to **https://api-console.zoho.com** (same datacenter as your Zoho People —
   US for `people.zoho.com`).
2. Click **Add Client → Self Client → Create**.
3. Copy the **Client ID** and **Client Secret**.

### 2. Configure env

```bash
cp .env.local.example .env.local
```

Paste `ZOHO_CLIENT_ID` and `ZOHO_CLIENT_SECRET`. Confirm the datacenter domains
(`.com` for US — change to `.eu`/`.in`/`.com.au` otherwise).

### 3. Generate a grant code → refresh token

1. In the Self Client, open the **Generate Code** tab.
2. Scope: `ZohoPeople.forms.ALL,ZohoPeople.leave.ALL`
3. Pick a duration, **Create**, copy the generated **code** (it expires in
   minutes — use it right away).
4. Exchange it for a long-lived refresh token:

   ```bash
   npm run zoho:token -- PASTE_THE_CODE_HERE
   ```

5. Copy the printed `ZOHO_REFRESH_TOKEN=...` line into `.env.local`.

### 4. Discover your leave type IDs

```bash
npm run zoho:leavetypes -- someone@byrdsonservices.com
```

Find the numeric `Id` for each relevant leave type and paste them into:

```
ZOHO_LEAVETYPE_HOLIDAY=...
ZOHO_LEAVETYPE_HOLIDAY_CREDIT=...
ZOHO_LEAVETYPE_WORKED_HOLIDAY=...
```

If your account's leave form uses a different reason field name, set
`ZOHO_LEAVE_REASON_FIELD` (the script's output / Zoho form designer shows it).

## Run

```bash
npm install
npm run dev        # http://localhost:3010
```

## Deploy

Any Node host (Vercel, a VM, etc.). Set the same env vars in the host's secret
store — never commit `.env.local`. To replace the current
`app.byrdsonservices.com/flexi-holiday` page, point that route at this app.

## Files

- `app/page.tsx` — the form UI
- `app/api/leave/route.ts` — POST: apply holiday / credit
- `app/api/leave-types/route.ts` — GET: balances
- `lib/zoho.ts` — OAuth token refresh + Zoho API calls
- `lib/leave-map.ts` — (holiday type + action) → leave type mapping
- `scripts/get-refresh-token.mjs` — one-time refresh-token bootstrap
- `scripts/list-leave-types.mjs` — discover leave type IDs
