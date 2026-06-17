"use client";

import { useEffect, useState } from "react";

type Pending = {
  key: string;
  workedDate: string;
  employeeName: string;
  employeeEmail: string;
  holidayName: string;
  hours: number;
  passed: boolean;
};

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-load when arriving from the form's admin button (/admin?email=…).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("email");
    if (q) {
      setEmail(q);
      loadPending(undefined, q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPending(e?: React.FormEvent, overrideEmail?: string) {
    e?.preventDefault();
    const useEmail = overrideEmail ?? email;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pending?email=${encodeURIComponent(useEmail)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed");
      setRows(data.rows || []);
      setAuthed(true);
    } catch (e2) {
      setErr((e2 as Error).message);
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

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
      setRows((rs) => rs.filter((r) => r.key !== key));
      setMsg(
        `Approved — ${data.credited.hours}h credited to ${data.credited.employee}.`,
      );
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
          <h1>Admin — Pending Credits</h1>
          <p>Enter your admin email to review pending holiday credits.</p>
        </div>
        <form className="card" onSubmit={loadPending}>
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
            {busy ? "Checking…" : "VIEW PENDING CREDITS"}
          </button>
          {err && <div className="alert err">{err}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="banner">
        <h1>Admin — Pending Credits</h1>
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

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{rows.length} pending</strong>
          <button type="button" onClick={() => loadPending()} disabled={busy} style={{ marginTop: 0 }}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {msg && <div className="alert ok">{msg}</div>}
        {err && <div className="alert err">{err}</div>}

        {rows.length === 0 ? (
          <p className="hint" style={{ marginTop: 16 }}>
            No pending credits.
          </p>
        ) : (
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
                {rows.map((r) => (
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
        )}
        <p className="hint" style={{ marginTop: 14 }}>
          Approving posts the holiday credit to Zoho immediately, bypassing the
          “holiday passed + 8h attendance” checks.
        </p>
      </div>
    </div>
  );
}
