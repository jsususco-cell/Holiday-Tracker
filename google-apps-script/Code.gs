/**
 * Byrdson Flexi-Holiday — Google Sheet receiver + pending-credit queue.
 *
 * Deploy as a Web App bound to your Holiday Tracker spreadsheet:
 *   1. Sheet → Extensions → Apps Script → paste this into Code.gs.
 *   2. (Recommended) Project Settings → Script Properties → WEBHOOK_SECRET=<random>,
 *      and set the same value in the app's GOOGLE_SHEET_WEBHOOK_SECRET.
 *   3. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
 *   4. Copy the Web App URL → app env var GOOGLE_SHEET_WEBHOOK_URL.
 *
 * IMPORTANT: after editing this script, redeploy a NEW VERSION
 * (Deploy → Manage deployments → Edit → Version: New version).
 *
 * Tabs:
 *   - RegularRawData / SpecialRawData : submission logs (per holiday type)
 *   - PendingCredits                  : queue of holiday credits awaiting the
 *                                       holiday to pass + attendance >= 8h
 */

var REGULAR_SHEET_NAME = "RegularRawData";
var SPECIAL_SHEET_NAME = "SpecialRawData";
var PENDING_SHEET_NAME = "PendingCredits";

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

var SPECIAL_HEADERS = [
  "Date of Filing",
  "Holiday Name",
  "Employee Name",
  "Choose your Action",
  "From Date (Original Holiday)",
  "To Date",
  "Notes",
];

var PENDING_HEADERS = [
  "Key",
  "Worked Date",
  "Employee Id",
  "Employee Email",
  "Employee Name",
  "Holiday Name",
  "Hours",
  "Status",
  "Note",
  "Updated",
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!checkSecret_(body.secret)) return json_({ ok: false, error: "Unauthorized" });

    var kind = body.kind || "log";
    if (kind === "pending") return upsertPending_(body.pending || {});
    if (kind === "mark") return markPending_(body.key, body.status, body.note);
    return logRow_(body.row || {});
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (!checkSecret_(params.secret)) return json_({ ok: false, error: "Unauthorized" });
  if (params.action === "pending") return json_({ ok: true, rows: listPending_() });
  return json_({ ok: true, message: "Flexi-Holiday webhook is live." });
}

/* ── submission log ── */
function logRow_(row) {
  var isSpecial = String(row.holidayType || "").toLowerCase().indexOf("special") !== -1;
  var sheetName = isSpecial ? SPECIAL_SHEET_NAME : REGULAR_SHEET_NAME;
  var sheet = getOrCreate_(sheetName, isSpecial ? SPECIAL_HEADERS : REGULAR_HEADERS);

  var values = isSpecial
    ? [
        row.dateOfFiling || "",
        row.holidayName || "",
        row.employeeName || "",
        row.action || "",
        row.fromDate || "",
        row.toDate || "",
        row.notes || "",
      ]
    : [
        row.dateOfFiling || "",
        row.holidayName || "",
        row.employeeName || "",
        row.action || "",
        row.useFlexiCredit || "",
        row.workBenefit || row.holidayType || "",
        row.fromDate || "",
        row.toDate || "",
        row.notes || "",
        "",
      ];
  sheet.appendRow(values);
  return json_({ ok: true, sheet: sheetName });
}

/* ── pending credit queue ── */
function upsertPending_(p) {
  var sheet = getOrCreate_(PENDING_SHEET_NAME, PENDING_HEADERS);
  var key = String(p.key || "");
  if (!key) return json_({ ok: false, error: "Missing key" });

  // De-dupe by Key (col A) — ignore if it already exists.
  var keys = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
  for (var i = 1; i < keys.length; i++) {
    if (String(keys[i][0]) === key) return json_({ ok: true, duplicate: true });
  }
  sheet.appendRow([
    key,
    p.workedDate || "",
    p.employeeId || "",
    p.employeeEmail || "",
    p.employeeName || "",
    p.holidayName || "",
    p.hours || "",
    "PENDING",
    "",
    new Date().toISOString(),
  ]);
  return json_({ ok: true });
}

function listPending_() {
  var sheet = getOrCreate_(PENDING_SHEET_NAME, PENDING_HEADERS);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var data = sheet.getRange(2, 1, last - 1, PENDING_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (String(r[7]) === "PENDING") {
      out.push({
        key: String(r[0]),
        workedDate: String(r[1]),
        employeeId: String(r[2]),
        employeeEmail: String(r[3]),
        employeeName: String(r[4]),
        holidayName: String(r[5]),
        hours: r[6],
      });
    }
  }
  return out;
}

function markPending_(key, status, note) {
  var sheet = getOrCreate_(PENDING_SHEET_NAME, PENDING_HEADERS);
  var last = sheet.getLastRow();
  if (last < 2) return json_({ ok: false, error: "No rows" });
  var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) {
      var row = i + 2;
      sheet.getRange(row, 8).setValue(status || "");
      sheet.getRange(row, 9).setValue(note || "");
      sheet.getRange(row, 10).setValue(new Date().toISOString());
      return json_({ ok: true });
    }
  }
  return json_({ ok: false, error: "Key not found" });
}

/* ── helpers ── */
function getOrCreate_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function checkSecret_(provided) {
  var expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
  return !expected || provided === expected;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
