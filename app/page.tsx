"use client";

import { useCallback, useEffect, useState } from "react";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/10ShAanTgN8VFYrotEiJTJQlBJwsXjrRWX1oo7SQEPtg/edit?gid=1456496038#gid=1456496038";

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

// Shared field styles (navy borders, square-ish, no pills).
const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-[#0B1F3A]/30 rounded-sm text-[#0B1F3A] focus:outline-none focus:border-[#0B1F3A] focus:ring-1 focus:ring-[#0B1F3A]";
const labelCls =
  "block text-xs font-semibold tracking-wide uppercase text-[#0B1F3A] mt-5 mb-1.5";

function Header() {
  const [stamp, setStamp] = useState("");
  useEffect(() => {
    setStamp(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);
  return (
    <header className="fixed top-0 inset-x-0 z-10 bg-white border-b border-[#0B1F3A]/15">
      <div className="max-w-5xl mx-auto px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#0B1F3A] font-bold text-sm sm:text-base uppercase tracking-widest">
            Byrdson Services
          </span>
          <span className="text-[#6B7280] text-xs sm:text-sm">
            Operations Portal // Work &amp; Benefit Filing
          </span>
        </div>
        <p className="text-[#6B7280] text-[11px] mt-0.5">
          Filing Date: {stamp || " "}
        </p>
      </div>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <Header />
      <main className="pt-24 pb-16 px-4 flex justify-center">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}

export default function FlexiHolidayPage() {
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
      <Shell>
        <div className="bg-white border border-[#0B1F3A]/15 rounded-sm p-7">
          <h1 className="text-lg font-bold text-[#0B1F3A] uppercase tracking-wide">
            Work &amp; Benefit Filing
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Sign in with your Byrdson (Zoho) email to begin.
          </p>
          <form onSubmit={handleSignIn}>
            <label className={labelCls}>
              Zoho Email <span className="text-[#C0392B]">*</span>
            </label>
            <input
              type="email"
              required
              autoFocus
              className={inputCls}
              placeholder="you@byrdsonservices.com"
              value={signinEmail}
              onChange={(e) => setSigninEmail(e.target.value)}
            />
            <p className="text-xs text-[#6B7280] mt-1.5">
              We&apos;ll verify it against Zoho People and pre-fill your details.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={signinBusy}
                className="rounded-none bg-[#C0392B] hover:bg-[#96261F] disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 transition-colors"
              >
                {signinBusy ? "Verifying…" : "SIGN IN →"}
              </button>
            </div>
            {signinErr && (
              <div className="mt-4 border-l-4 border-[#C0392B] bg-[#C0392B]/5 px-4 py-3 text-sm text-[#0B1F3A]">
                {signinErr}
              </div>
            )}
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <HolidayForm employee={employee} onSignOut={() => setEmployee(null)} />
    </Shell>
  );
}

function HolidayForm({
  employee,
  onSignOut,
}: {
  employee: Employee;
  onSignOut: () => void;
}) {
  const initial = {
    holidayType: "regular",
    filing: today(),
    action: "take_day_off",
    workBenefit: "double_pay",
    holidayIdx: "",
    notes: "",
  };

  const [holidayType, setHolidayType] = useState(initial.holidayType);
  const [filing, setFiling] = useState(initial.filing);
  const [action, setAction] = useState(initial.action);
  const [workBenefit, setWorkBenefit] = useState(initial.workBenefit);
  const [year, setYear] = useState(thisYear());
  const [years, setYears] = useState<number[]>([thisYear()]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayIdx, setHolidayIdx] = useState(initial.holidayIdx);
  const [notes, setNotes] = useState(initial.notes);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isReport = action === "report_to_work";
  const isSpecial = holidayType === "special";

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

  function resetForm() {
    setHolidayType(initial.holidayType);
    setFiling(today());
    setAction(initial.action);
    setWorkBenefit(initial.workBenefit);
    setYear(thisYear());
    setHolidayIdx("");
    setNotes("");
    setMsg(null);
  }

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

      let text = `Filing submitted — ${employee.name} · ${holiday.name}.`;
      if (data.creditEarned) {
        text += data.zoho?.ok
          ? " Holiday credit added to Zoho People."
          : ` (Saved to the sheet, but the Zoho credit failed: ${data.zoho?.error})`;
      }
      setMsg({ ok: data.creditEarned ? !!data.zoho?.ok : true, text });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (active: boolean) =>
    `flex-1 rounded-none border px-3 py-2.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-[#0B1F3A] text-white border-[#0B1F3A]"
        : "bg-white text-[#6B7280] border-[#0B1F3A]/20 hover:bg-[#0B1F3A]/5"
    }`;

  return (
    <div className="bg-white border border-[#0B1F3A]/15 rounded-sm">
      {/* card header */}
      <div className="flex items-center justify-between px-7 pt-6">
        <h1 className="text-lg font-bold text-[#0B1F3A] uppercase tracking-wide">
          Work &amp; Benefit Filing
        </h1>
        <span className="text-xs text-[#6B7280]">
          {employee.name || employee.email} ·{" "}
          <button
            type="button"
            onClick={onSignOut}
            className="underline hover:text-[#0B1F3A]"
          >
            sign out
          </button>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="px-7 pb-6">
        {/* holiday type tabs */}
        <div className="flex gap-2 mt-5">
          {HOLIDAY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={tabBtn(holidayType === t.value)}
              onClick={() => setHolidayType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className={labelCls}>
          Date of Filing <span className="text-[#C0392B]">*</span>
        </label>
        <input
          type="date"
          required
          className={inputCls}
          value={filing}
          onChange={(e) => setFiling(e.target.value)}
        />

        <label className={labelCls}>
          Action <span className="text-[#C0392B]">*</span>
        </label>
        <select
          className={inputCls}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        {/* Benefit choice only for Regular + Report to Work */}
        {isReport && !isSpecial && (
          <>
            <label className={labelCls}>
              Benefit for reporting to work{" "}
              <span className="text-[#C0392B]">*</span>
            </label>
            <select
              className={inputCls}
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
              <p className="text-xs text-[#6B7280] mt-1.5">
                A holiday credit will be added to your Zoho People balance.
              </p>
            )}
          </>
        )}

        <div className="flex gap-3">
          <div className="w-28">
            <label className={labelCls}>Year</label>
            <select
              className={inputCls}
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
          <div className="flex-1">
            <label className={labelCls}>
              {isSpecial ? "Non-Working Holiday Name" : "Holiday Name"}{" "}
              <span className="text-[#C0392B]">*</span>
            </label>
            <select
              className={inputCls}
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

        <label className={labelCls}>Employee&apos;s Name</label>
        <input
          type="text"
          readOnly
          className={`${inputCls} bg-[#F4F5F7] cursor-not-allowed`}
          value={employee.name}
        />

        <label className={labelCls}>Employee Email</label>
        <input
          type="email"
          readOnly
          className={`${inputCls} bg-[#F4F5F7] cursor-not-allowed`}
          value={employee.email}
        />

        <label className={labelCls}>Notes</label>
        <textarea
          className={`${inputCls} min-h-[84px] resize-y`}
          placeholder="Notes should be added only when Holiday Credit will be used."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* footer */}
        <div className="mt-7 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-none text-sm font-medium text-[#0B1F3A] hover:underline px-2 py-2.5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-none bg-[#C0392B] hover:bg-[#96261F] disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 transition-colors"
          >
            {busy ? "Submitting…" : "SUBMIT TO OPERATIONS →"}
          </button>
        </div>

        {msg && (
          <div
            className={`mt-5 border-l-4 ${
              msg.ok ? "border-[#0B1F3A]" : "border-[#C0392B]"
            } bg-[#0B1F3A]/[0.04] px-4 py-3 text-sm text-[#0B1F3A]`}
          >
            {msg.text}
            {msg.ok && (
              <>
                {" "}
                <a
                  href={SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Open Operations Sheet →
                </a>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
