/**
 * Byrdson Flexi-Holiday — Google Sheet receiver.
 *
 * Deploy as a Web App bound to your Holiday Tracker spreadsheet:
 *   1. Sheet → Extensions → Apps Script → paste this into Code.gs.
 *   2. (Optional) Project Settings → Script Properties → WEBHOOK_SECRET=<random>,
 *      and set the same value in the app's GOOGLE_SHEET_WEBHOOK_SECRET.
 *   3. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
 *   4. Copy the Web App URL → app env var GOOGLE_SHEET_WEBHOOK_URL.
 *
 * IMPORTANT: after editing this script you must redeploy a NEW VERSION
 * (Deploy → Manage deployments → Edit → Version: New version) for changes to
 * take effect.
 *
 * Routing: Regular Holiday submissions go to the "RegularRawData" tab, Special
 * Non-Working submissions go to "SpecialRawData". Missing tabs are created with
 * headers automatically.
 */

var REGULAR_SHEET_NAME = "RegularRawData";
var SPECIAL_SHEET_NAME = "SpecialRawData";

// Regular Holiday layout (full).
var REGULAR_HEADERS = [
  "Date of Filing",
  "Holiday Name",
  "Employee Name",
  "Choose your Action",
  "Use Flexi-Holiday Credit",
  "Benefit",
  "From Date (Original Holiday)",
  "To Date",
  "Notes",
  "Approved?",
];

// Special Non-Working layout (no credit / benefit / approved columns).
var SPECIAL_HEADERS = [
  "Date of Filing",
  "Holiday Name",
  "Employee Name",
  "Choose your Action",
  "From Date (Original Holiday)",
  "To Date",
  "Notes",
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (expected && body.secret !== expected) {
      return json_({ ok: false, error: "Unauthorized" });
    }

    var row = body.row || {};

    // Route by holiday type. The app sends holidayType as "Regular Holiday" or
    // "Special Non-Working Holiday".
    var isSpecial = String(row.holidayType || "").toLowerCase().indexOf("special") !== -1;
    var sheetName = isSpecial ? SPECIAL_SHEET_NAME : REGULAR_SHEET_NAME;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(isSpecial ? SPECIAL_HEADERS : REGULAR_HEADERS);
    }

    var values;
    if (isSpecial) {
      // Date of Filing | Holiday Name | Employee Name | Choose your Action |
      // From Date (Original Holiday) | To Date | Notes
      values = [
        row.dateOfFiling || "",
        row.holidayName || "",
        row.employeeName || "",
        row.action || "",
        row.fromDate || "",
        row.toDate || "",
        row.notes || "",
      ];
    } else {
      values = [
        row.dateOfFiling || "",
        row.holidayName || "",
        row.employeeName || "",
        row.action || "",
        row.useFlexiCredit || "",
        row.workBenefit || row.holidayType || "",
        row.fromDate || "",
        row.toDate || "",
        row.notes || "",
        "", // Approved? — left blank for HR
      ];
    }
    sheet.appendRow(values);

    return json_({ ok: true, sheet: sheetName });
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
