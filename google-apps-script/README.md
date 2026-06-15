# Google Sheet receiver (Apps Script)

`Code.gs` is a tiny Web App that appends each flexi-holiday submission as a row
to your [Holiday Tracker sheet](https://docs.google.com/spreadsheets/d/10ShAanTgN8VFYrotEiJTJQlBJwsXjrRWX1oo7SQEPtg/edit).

## Deploy

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with the contents of [`Code.gs`](Code.gs).
3. Confirm `RESPONSES_SHEET_NAME` at the top matches the tab that has the
   `Date of Filing … Approved?` headers (rename it in the script if needed).
4. *(Recommended)* **Project Settings → Script Properties → Add** →
   `WEBHOOK_SECRET` = a random string. Put the same value in the app's
   `GOOGLE_SHEET_WEBHOOK_SECRET`.
5. **Deploy → New deployment → Web app** — *Execute as: Me*, *Who has access:
   Anyone*. Authorize when prompted.
6. Copy the **Web app URL** into the app's `GOOGLE_SHEET_WEBHOOK_URL`.

## Routing

Submissions are split by holiday type:

- **Regular Holiday** → `RegularRawData` tab — full layout:
  `Date of Filing | Holiday Name | Employee Name | Choose your Action |
  Use Flexi-Holiday Credit | Benefit | From Date (Original Holiday) | To Date |
  Notes | Approved?`
- **Special Non-Working Holiday** → `SpecialRawData` tab — trimmed layout:
  `Date of Filing | Holiday Name | Employee Name | Choose your Action |
  From Date (Original Holiday) | To Date | Notes`

If a tab is missing it's created automatically with its own headers.

## Notes

- Because it runs **as you**, it can write to the sheet without a service
  account or shared key file. The optional secret stops random callers.
- The **Summary** sheet (Accumulated / Used / Balance) is expected to compute
  from these rows via formulas — this script only appends rows.
- **After editing this script you MUST redeploy a new version**
  (Deploy → Manage deployments → Edit → Version: *New version* → Deploy).
  The Web App URL stays the same, so no env change is needed.
