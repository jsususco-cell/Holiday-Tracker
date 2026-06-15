"use client";

import { useCallback, useEffect, useState } from "react";

const HOLIDAY_TYPES = [
  { value: "regular", label: "Regular Holiday" },
  { value: "special", label: "Special Non-Working Holiday" },
];

const ACTIONS = [
  { value: "take_day_off", label: "Take Day Off" },
  { value: "report_to_work", label: "Report to Work" },
];

const WORK_BENEFITS = [
  { value: "double_pay", label: "Double Pay" },
  { value: "earn_credit", label: "Earn Holiday Credit" },
];

type Employee = { id: string; name: string; email: string };
type Holiday = { date: string; name: string; type: "regular" | "special" };

function today() {
  return new Date().toISOString().slice(0, 10);
}
function thisYear() {
  return new Date().getFullYear();
}

export default function FlexiHolidayPage() {
  // ── sign-in ──
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [signinEmail, setSigninEmail] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinErr, setSigninErr] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSigninErr(null);
    setSigninBusy(true);
    try {
      const res = await fetch(`/api/me?email=${encodeURIComponent(signinEmail)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sign-in failed");
      setEmployee(data.employee);
    } catch (err) {
      setSigninErr((err as Error).message);
    } finally {
      setSigninBusy(false);
    }
  }

  if (!employee) {
    return (
      <div className="wrap">
        <div className="banner">
          <h1>Flexi Holiday</h1>
          <p>Sign in with your Byrdson (Zoho) email to file a holiday.</p>
        </div>
        <form className="card" onSubmit={handleSignIn}>
          <label>
            Zoho Email <span className="req">*</span>
          </label>
          <input
            type="email"
            required
            autoFocus
            placeholder="you@byrdsonservices.com"
            value={signinEmail}
            onChange={(e) => setSigninEmail(e.target.value)}
          />
          <p className="hint">
            We&apos;ll verify it against Zoho People and pre-fill your details.
          </p>
          <button type="submit" disabled={signinBusy}>
            {signinBusy ? "Verifying…" : "SIGN IN"}
          </button>
          {signinErr && <div className="alert err">{signinErr}</div>}
        </form>
      </div>
    );
  }

  return <HolidayForm employee={employee} onSignOut={() => setEmployee(null)} />;
}

function HolidayForm({
  employee,
  onSignOut,
}: {
  employee: Employee;
  onSignOut: () => void;
}) {
  const [holidayType, setHolidayType] = useState("regular");
  const [filing, setFiling] = useState(today());
  const [action, setAction] = useState("take_day_off");
  const [workBenefit, setWorkBenefit] = useState("double_pay");
  const [year, setYear] = useState(thisYear());
  const [years, setYears] = useState<number[]>([thisYear()]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayIdx, setHolidayIdx] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isReport = action === "report_to_work";
  const isSpecial = holidayType === "special";

  // Load only the holidays of the selected type (Regular vs Special), per the
  // active tab — so each tab's dropdown shows just its own holidays.
  const loadHolidays = useCallback(async (y: number, type: string) => {
    try {
      const res = await fetch(`/api/holidays?year=${y}&type=${type}`);
      const data = await res.json();
      if (data.ok) {
        setHolidays(data.holidays || []);
        if (Array.isArray(data.years) && data.years.length) setYears(data.years);
      } else {
        setHolidays([]);
      }
    } catch {
      setHolidays([]);
    }
  }, []);

  useEffect(() => {
    loadHolidays(year, holidayType);
    setHolidayIdx("");
  }, [year, holidayType, loadHolidays]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const holiday = holidays[Number(holidayIdx)];
    if (!holiday) {
      setMsg({ ok: false, text: "Please choose a holiday." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holidayType,
          dateOfFiling: filing,
          action,
          workBenefit: isReport && !isSpecial ? workBenefit : "",
          holidayName: holiday.name,
          holidayDate: holiday.date,
          employeeName: employee.name,
          employeeEmail: employee.email,
          employeeId: employee.id,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Submission failed");

      let text = "Submitted — saved to the spreadsheet.";
      if (data.creditEarned) {
        text = data.pending?.ok
          ? "Submitted. Your holiday credit is recorded and will post to Zoho People after the holiday, once your attendance for that day is 8 hours or more."
          : `Saved to the spreadsheet, but registering the pending credit failed: ${data.pending?.error}`;
      }
      setMsg({ ok: data.creditEarned ? !!data.pending?.ok : true, text });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="banner">
        <h1>Flexi Holiday</h1>
        <p>
          Signed in as <strong>{employee.name || employee.email}</strong> ·{" "}
          <a
            href="#"
            style={{ color: "#fff", textDecoration: "underline" }}
            onClick={(e) => {
              e.preventDefault();
              onSignOut();
            }}
          >
            sign out
          </a>
        </p>
      </div>

      <div className="tabs">
        {HOLIDAY_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={holidayType === t.value ? "active" : ""}
            onClick={() => setHolidayType(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <label>
          Date of Filing <span className="req">*</span>
        </label>
        <input
          type="date"
          required
          value={filing}
          onChange={(e) => setFiling(e.target.value)}
        />

        <label>
          Action <span className="req">*</span>
        </label>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        {/* Benefit choice (Double Pay / Earn Credit) only applies to Regular
            holidays. Special Non-Working holidays keep the actions but have no
            benefit sub-choice. */}
        {isReport && !isSpecial && (
          <>
            <label>
              Benefit for reporting to work <span className="req">*</span>
            </label>
            <select
              value={workBenefit}
              onChange={(e) => setWorkBenefit(e.target.value)}
            >
              {WORK_BENEFITS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            {workBenefit === "earn_credit" && (
              <p className="hint">
                A holiday credit will be added to your Zoho People balance.
              </p>
            )}
          </>
        )}

        <div className="row">
          <div style={{ flex: "0 0 110px" }}>
            <label>Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>
              {isSpecial ? "Non-Working Holiday Name" : "Holiday Name"}{" "}
              <span className="req">*</span>
            </label>
            <select
              value={holidayIdx}
              onChange={(e) => setHolidayIdx(e.target.value)}
              required
            >
              <option value="">
                {holidays.length
                  ? "Select a holiday…"
                  : "No holidays listed for this year"}
              </option>
              {holidays.map((h, i) => (
                <option key={h.date + i} value={i}>
                  {h.name} ({h.date})
                </option>
              ))}
            </select>
          </div>
        </div>

        <label>Employee&apos;s Name</label>
        <input type="text" value={employee.name} readOnly />

        <label>Employee Email</label>
        <input type="email" value={employee.email} readOnly />

        <label>Notes</label>
        <textarea
          placeholder="Notes should be added only when Holiday Credit will be used."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button type="submit" disabled={busy}>
          {busy ? "Submitting…" : "SEND"}
        </button>

        {msg && (
          <div className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
        )}
      </form>
    </div>
  );
}
