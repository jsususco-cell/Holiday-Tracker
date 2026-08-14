"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Pending = {
  key: string;
  workedDate: string;
  employeeName: string;
  employeeEmail: string;
  holidayName: string;
  hours: number;
  passed: boolean;
};

type Submission = {
  holidayType: string;
  dateOfFiling: string;
  holidayName: string;
  employeeName: string;
  action: string;
  benefit: string;
  fromDate: string;
  toDate: string;
  notes: string;
  approved: string;
  category: string;
  creditStatus?: string;
};

type Counts = Record<string, number>;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "earn_credit", label: "Earn Credit" },
  { key: "double_pay", label: "Double Pay" },
  { key: "take_day_off", label: "Take Day Off" },
];

const CATEGORY_LABEL: Record<string, string> = {
  earn_credit: "Earn Credit",
  double_pay: "Double Pay",
  take_day_off: "Take Day Off",
  report_to_work: "Report to Work",
};

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"submissions" | "pending">("submissions");

  const [rows, setRows] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [filter, setFilter] = useState("all");
  const [year, setYear] = useState("all");
  const [holiday, setHoliday] = useState("all");

  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Default the year once per session, not on every Refresh — otherwise the
  // admin's chosen year would jump back while they're browsing history.
  const yearInitialised = useRef(false);

  const load = useCallback(async (who: string) => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const [s, p] = await Promise.all([
        fetch(`/api/admin/submissions?email=${encodeURIComponent(who)}`).then((r) => r.json()),
        fetch(`/api/admin/pending?email=${encodeURIComponent(who)}`).then((r) => r.json()),
      ]);
      if (!s.ok) throw new Error(s.error || "Failed to load submissions");
      setRows(s.rows || []);
      setCounts(s.counts || {});

      // Open on the current year; fall back to the most recent year that has
      // data (so the view is never empty on arrival).
      if (!yearInitialised.current) {
        const years = Array.from(
          new Set((s.rows || []).map((r: Submission) => (r.fromDate || "").slice(0, 4)).filter(Boolean)),
        ).sort((a, b) => (b as string).localeCompare(a as string)) as string[];
        const thisYear = String(new Date().getFullYear());
        setYear(years.includes(thisYear) ? thisYear : years[0] || "all");
        yearInitialised.current = true;
      }
      if (p.ok) setPending(p.rows || []);
      setAuthed(true);
    } catch (e) {
      setErr((e as Error).message);
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("email");
    if (q) {
      setEmail(q);
      load(q);
    }
  }, [load]);

  async function approve(key: string) {
    setErr(null);
    setMsg(null);
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, key }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Approve failed");
      setPending((rs) => rs.filter((r) => r.key !== key));
      setMsg(`Approved — ${data.credited.hours}h credited to ${data.credited.employee}.`);
      load(email);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  if (!authed) {
    return (
      <div className="wrap">
        <div className="banner">
          <h1>Admin — Flexi Holiday</h1>
          <p>Enter your admin email to view submissions.</p>
        </div>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            load(email);
          }}
        >
          <label>
            Admin Email <span className="req">*</span>
          </label>
          <input
            type="email"
            required
            autoFocus
            placeholder="admin@byrdsonservices.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "VIEW SUBMISSIONS"}
          </button>
          {err && <div className="alert err">{err}</div>}
        </form>
      </div>
    );
  }

  // Filters narrow in order: category -> year -> holiday. Each dropdown's
  // options come from the preceding subset, so nothing offers an empty result.
  // Year is the year of the HOLIDAY (fromDate), not the filing date — the same
  // holiday falls on a different date each year.
  const byCategory = filter === "all" ? rows : rows.filter((r) => r.category === filter);

  const yearOptions = Array.from(
    new Set(byCategory.map((r) => (r.fromDate || "").slice(0, 4)).filter(Boolean)),
  ).sort((a, b) => b.localeCompare(a)); // newest year first

  const byYear =
    year === "all" ? byCategory : byCategory.filter((r) => (r.fromDate || "").startsWith(year));

  const holidayOptions = Array.from(
    new Set(byYear.map((r) => r.holidayName).filter(Boolean)),
  ).sort();

  const shown = (holiday === "all"
    ? byYear
    : byYear.filter((r) => r.holidayName === holiday)
  )
    .slice()
    // Latest on top: newest filing first, then newest holiday date.
    .sort(
      (a, b) =>
        (b.dateOfFiling || "").localeCompare(a.dateOfFiling || "") ||
        (b.fromDate || "").localeCompare(a.fromDate || ""),
    );

  return (
    <div className="wrap">
      <div className="banner">
        <h1>Admin — Flexi Holiday</h1>
        <p>
          {email} ·{" "}
          <a
            href="#"
            style={{ color: "#fff", textDecoration: "underline" }}
            onClick={(e) => {
              e.preventDefault();
              setAuthed(false);
            }}
          >
            switch user
          </a>
        </p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === "submissions" ? "active" : ""}
          onClick={() => setTab("submissions")}
        >
          Submissions ({counts.all ?? 0})
        </button>
        <button
          type="button"
          className={tab === "pending" ? "active" : ""}
          onClick={() => setTab("pending")}
        >
          Pending Credits ({pending.length})
        </button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <strong>
            {tab === "submissions" ? `${shown.length} submission(s)` : `${pending.length} awaiting credit`}
          </strong>
          <button type="button" onClick={() => load(email)} disabled={busy} style={{ marginTop: 0 }}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {msg && <div className="alert ok">{msg}</div>}
        {err && <div className="alert err">{err}</div>}

        {tab === "submissions" ? (
          <>
            <div className="tabs" style={{ marginTop: 16, marginBottom: 0 }}>
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={filter === f.key ? "active" : ""}
                  onClick={() => {
                    // Keep the chosen year if the new category still has rows
                    // in it; otherwise widen to All years rather than show none.
                    const subset = f.key === "all" ? rows : rows.filter((r) => r.category === f.key);
                    const yrs = new Set(subset.map((r) => (r.fromDate || "").slice(0, 4)));
                    setFilter(f.key);
                    setYear((y) => (y !== "all" && yrs.has(y) ? y : "all"));
                    setHoliday("all");
                  }}
                  style={{ fontSize: 13, padding: "9px 10px" }}
                >
                  {f.label} ({counts[f.key] ?? 0})
                </button>
              ))}
            </div>

            <div className="row" style={{ marginTop: 4 }}>
              <div style={{ flex: "0 0 150px" }}>
                <label>Holiday year</label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setHoliday("all");
                  }}
                >
                  <option value="all">All years ({byCategory.length})</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y} ({byCategory.filter((r) => (r.fromDate || "").startsWith(y)).length})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Holiday</label>
                <select value={holiday} onChange={(e) => setHoliday(e.target.value)}>
                  <option value="all">All holidays ({byYear.length})</option>
                  {holidayOptions.map((h) => (
                    <option key={h} value={h}>
                      {h} ({byYear.filter((r) => r.holidayName === h).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="hint" style={{ marginTop: 16 }}>
                No submissions in this view.
              </p>
            ) : (
              <div className="balances" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Filed</th>
                      <th>Employee</th>
                      <th>Holiday</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <tr key={i}>
                        <td>{r.dateOfFiling}</td>
                        <td>{r.employeeName}</td>
                        <td>
                          {r.holidayName}
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {r.holidayType === "Regular Holiday" ? "Regular" : "Special Non-Working"}
                          </div>
                        </td>
                        <td>{r.fromDate}</td>
                        <td>{CATEGORY_LABEL[r.category] || r.action}</td>
                        <td>
                          {r.category === "earn_credit"
                            ? r.creditStatus || "PENDING"
                            : r.category === "double_pay"
                              ? "For payroll"
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint" style={{ marginTop: 14 }}>
              Every filing is stored in the Google Sheet; this view reads from it.
            </p>
          </>
        ) : pending.length === 0 ? (
          <p className="hint" style={{ marginTop: 16 }}>
            No pending credits.
          </p>
        ) : (
          <>
            <div className="balances" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Holiday</th>
                    <th>Worked date</th>
                    <th>Hrs</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.key}>
                      <td>{r.employeeName}</td>
                      <td>{r.holidayName}</td>
                      <td>{r.workedDate}</td>
                      <td>{r.hours}</td>
                      <td>{r.passed ? "Holiday passed" : "Upcoming"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => approve(r.key)}
                          disabled={busyKey === r.key}
                          style={{ marginTop: 0, padding: "6px 14px", fontSize: 13 }}
                        >
                          {busyKey === r.key ? "Approving…" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 14 }}>
              Approving posts the credit to Zoho immediately, bypassing the “holiday
              passed + 8h attendance” checks.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
