/**
 * Byrdson Flexi-Holiday — Google Sheet receiver.
 *
 * Deploy this as a Web App bound to your Holiday Tracker spreadsheet:
 *   1. Open the sheet → Extensions → Apps Script.
 *   2. Paste this file's contents into Code.gs (replace anything there).
 *   3. (Optional) set a shared secret: Project Settings → Script Properties →
 *      add  WEBHOOK_SECRET = <some-random-string>  and put the same value in
 *      the app's GOOGLE_SHEET_WEBHOOK_SECRET env var.
 *   4. Deploy → New deployment → type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone   (the secret protects it)
 *   5. Copy the Web App URL → app env var GOOGLE_SHEET_WEBHOOK_URL.
 *
 * It appends one row to the responses sheet. Your Summary sheet's formulas
 * (Accumulated / Used / Balance) roll up automatically from these rows.
 */

// Name of the tab that holds form responses (the one with the headers
// "Date of Filing", "Holiday Name", ... "Approved?"). Change if different.
var RESPONSES_SHEET_NAME = "Form Responses";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (expected && body.secret !== expected) {
      return json_({ ok: false, error: "Unauthorized" });
    }

    var row = body.row || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(RESPONSES_SHEET_NAME) || ss.getSheets()[0];

    // Column order matches the existing tracker headers:
    // Date of Filing | Holiday Name | Employee Name | Choose your Action |
    // Use Flexi-Holiday Credit | Benefit | From Date (Original Holiday) |
    // To Date | Notes | Approved?
    sheet.appendRow([
      row.dateOfFiling || "",
      row.holidayName || "",
      row.employeeName || "",
      row.action || "",
      row.useFlexiCredit || "",
      row.workBenefit || row.holidayType || "",
      row.fromDate || "",
      row.toDate || "",
      row.notes || "",
      "", // Approved? — left blank for HR to fill
    ]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: "Flexi-Holiday webhook is live." });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
