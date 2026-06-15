"use client";

import { useState } from "react";

const ACTIONS = [
  { value: "take_holiday", label: "Apply / take a holiday off" },
  { value: "use_credit", label: "Use holiday credit" },
  { value: "credit_worked", label: "Credit a worked holiday" },
  { value: "report", label: "Just show my balances" },
];

type LeaveType = {
  Name?: string;
  Id?: string;
  AvailableCount?: string;
  BookedCount?: string;
  [k: string]: unknown;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function FlexiHolidayPage() {
  const [filing, setFiling] = useState(today());
  const [action, setAction] = useState("take_holiday");
  const [holidayName, setHolidayName] = useState("");
  const [benefit, setBenefit] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [balances, setBalances] = useState<LeaveType[] | null>(null);

  const isReport = action === "report";

  async function loadBalances() {
    if (!email) {
      setMsg({ ok: false, text: "Enter your email to load balances." });
      return;
    }
    setBusy(true);
    setMsg(null);
    setBalances(null);
    try {
      const res = await fetch(
        `/api/leave-types?email=${encodeURIComponent(email)}`,
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load balances");
      setBalances(data.types || []);
      if (!data.types?.length) {
        setMsg({ ok: true, text: "No leave types returned for this employee." });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (isReport) {
      await loadBalances();
      return;
    }

    if (!email || !from || !to) {
      setMsg({ ok: false, text: "Email, From and To dates are required." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          email,
          employeeName,
          holidayName,
          benefit,
          from,
          to,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Submission failed");
      setMsg({
        ok: true,
        text: "Submitted to Zoho People successfully.",
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="banner">
        <h1>Flexi Holiday</h1>
        <p>Apply holidays and holiday credit — synced directly to Zoho People.</p>
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
          Choose your action <span className="req">*</span>
        </label>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        {!isReport && (
          <>
            <label>Holiday Name</label>
            <input
              type="text"
              placeholder="e.g. New Year's Day"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />

            <label>Benefit</label>
            <input
              type="text"
              placeholder="e.g. Regular holiday pay"
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
            />

            <div className="row">
              <div>
                <label>
                  From <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label>
                  To <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <label>Employee&apos;s Name</label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
            />
          </>
        )}

        <label>
          Email <span className="req">*</span>
        </label>
        <input
          type="email"
          required
          placeholder="you@byrdsonservices.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {!isReport && (
          <>
            <label>Notes</label>
            <textarea
              placeholder="Notes should be added only when Holiday Credit will be used or when taking this off."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        )}

        <button type="submit" disabled={busy}>
          {busy ? "Working…" : isReport ? "SHOW BALANCES" : "SEND"}
        </button>

        {msg && (
          <div className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
        )}

        {balances && balances.length > 0 && (
          <div className="balances">
            <table>
              <thead>
                <tr>
                  <th>Leave type</th>
                  <th>Available</th>
                  <th>Booked</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr key={b.Id || i}>
                    <td>{b.Name ?? "—"}</td>
                    <td>{b.AvailableCount ?? "—"}</td>
                    <td>{b.BookedCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </form>
    </div>
  );
}
