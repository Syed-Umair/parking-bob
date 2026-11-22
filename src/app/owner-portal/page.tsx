"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParkingRequest {
  _id: string;
  rwaSlotId: string;
  rwaName: string;
  requesterName: string;
  requesterPhone: string;
  vehiclePlate: string;
  durationHours: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
}

// ─── Demo owner accounts (must match seed data) ───────────────────────────────

const DEMO_OWNERS = [
  { email: "admin@salarpuria-hsr.rwa",        name: "Salarpuria Sattva RWA",      locality: "HSR Layout" },
  { email: "admin@mantri-koramangala.rwa",    name: "Mantri Synergy RWA",          locality: "Koramangala" },
  { email: "admin@indiranagar100ft.rwa",      name: "Indiranagar RWA Association", locality: "Indiranagar" },
  { email: "admin@bellandur-lake.rwa",        name: "Bellandur Lake RWA",          locality: "Bellandur" },
  { email: "admin@prestige-whitefield.rwa",   name: "Prestige Shantiniketan RWA",  locality: "Whitefield" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-red-100 text-red-600",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerPortalPage() {
  const [phase, setPhase] = useState<"login" | "dashboard">("login");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName]   = useState("");
  const [loginError, setLoginError] = useState("");

  const [requests, setRequests]       = useState<ParkingRequest[]>([]);
  const [loading, setLoading]         = useState(false);
  const [actionId, setActionId]       = useState<string | null>(null);
  const [error, setError]             = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch requests for the logged-in owner
  const fetchRequests = useCallback(async (email: string) => {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/seed"); // ensure owners + slots exist
      const res  = await fetch(`/api/parking-requests?ownerEmail=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRequests(
        data.requests.sort(
          (a: ParkingRequest, b: ParkingRequest) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 15 s while on dashboard
  useEffect(() => {
    if (phase !== "dashboard") return;
    const id = setInterval(() => fetchRequests(ownerEmail), 15_000);
    return () => clearInterval(id);
  }, [phase, ownerEmail, fetchRequests]);

  // ── Simulated login — just match against the known demo owner list
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const owner = DEMO_OWNERS.find((o) => o.email === ownerEmail.trim().toLowerCase());
    if (!owner) {
      setLoginError("No owner account found for that email. Use one of the demo accounts below.");
      return;
    }
    setOwnerName(owner.name);
    setPhase("dashboard");
    fetchRequests(owner.email);
  }

  // ── Accept / Decline a request
  async function handleDecision(req: ParkingRequest, status: "ACCEPTED" | "DECLINED") {
    setActionId(req._id);
    setError("");
    try {
      const res  = await fetch("/api/parking-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: req._id, status }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRequests((prev) =>
        prev.map((r) => (r._id === req._id ? data.request : r))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionId(null);
    }
  }

  const pending  = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  // ─── Login screen ─────────────────────────────────────────────────────────

  if (phase === "login") {
    return (
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="bg-teal-700 text-white px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/80 hover:text-white text-lg">←</Link>
          <div>
            <div className="font-bold text-sm">Owner / Association Portal</div>
            <div className="text-teal-200 text-xs">Manage parking requests for your RWA</div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 pt-10 space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">🏢</div>
              <h2 className="text-xl font-bold text-slate-800">Owner Sign In</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your RWA admin email to manage parking requests.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  RWA Admin Email
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="admin@your-rwa.rwa"
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-800"
                />
              </div>
              {loginError && (
                <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Sign In →
              </button>
            </form>
          </div>

          {/* Demo account hints */}
          <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
              Demo Owner Accounts
            </p>
            {DEMO_OWNERS.map((o) => (
              <button
                key={o.email}
                onClick={() => setOwnerEmail(o.email)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-100 transition-colors"
              >
                <span className="text-xs font-semibold text-teal-800">{o.name}</span>
                <span className="text-xs text-teal-600 block font-mono">{o.email}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      {/* Top bar */}
      <div className="bg-teal-700 text-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setPhase("login")}
          className="text-white/80 hover:text-white text-lg"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="font-bold text-sm">{ownerName}</div>
          <div className="text-teal-200 text-xs">Owner Portal · Parking Requests</div>
        </div>
        <button
          onClick={() => fetchRequests(ownerEmail)}
          className="text-xs text-teal-200 hover:text-white font-medium"
        >
          ↺ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="bg-teal-700 px-4 pb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/10 p-3 text-center">
          <div className="text-2xl font-bold text-white">{pending.length}</div>
          <div className="text-xs text-teal-200 mt-0.5">Pending</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3 text-center">
          <div className="text-2xl font-bold text-white">
            {requests.filter((r) => r.status === "ACCEPTED").length}
          </div>
          <div className="text-xs text-teal-200 mt-0.5">Accepted</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3 text-center">
          <div className="text-2xl font-bold text-white">
            {requests.filter((r) => r.status === "DECLINED").length}
          </div>
          <div className="text-xs text-teal-200 mt-0.5">Declined</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* ── Pending requests ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              Pending Requests
            </h2>
            <span className="text-xs text-slate-400">
              {lastRefresh
                ? `Refreshed ${lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : ""}
            </span>
          </div>

          {loading && requests.length === 0 ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="rounded-2xl bg-white border border-slate-200 p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-slate-400 text-sm">
              <div className="text-3xl mb-2">✅</div>
              No pending requests right now.
              <br />
              Visitors can request a slot from the{" "}
              <Link href="/park" className="text-teal-700 underline font-medium">
                Find Parking
              </Link>{" "}
              page.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((req) => (
                <RequestCard
                  key={req._id}
                  req={req}
                  actionId={actionId}
                  onDecision={handleDecision}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── History ───────────────────────────────────────────────────── */}
        {resolved.length > 0 && (
          <section>
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-3">
              History
            </h2>
            <div className="space-y-2">
              {resolved.map((req) => (
                <RequestCard
                  key={req._id}
                  req={req}
                  actionId={actionId}
                  onDecision={handleDecision}
                />
              ))}
            </div>
          </section>
        )}

        <div className="pt-2">
          <Link
            href="/park"
            className="block rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            🅿️ View slot as visitor →
          </Link>
        </div>
      </div>
    </main>
  );
}

// ─── Request Card sub-component ───────────────────────────────────────────────

function RequestCard({
  req,
  actionId,
  onDecision,
}: {
  req: ParkingRequest;
  actionId: string | null;
  onDecision: (req: ParkingRequest, status: "ACCEPTED" | "DECLINED") => void;
}) {
  const isActing = actionId === req._id;
  const isPending = req.status === "PENDING";

  return (
    <div
      className={`rounded-2xl bg-white border shadow-sm p-4 space-y-3 transition-opacity ${
        isPending ? "border-slate-200 opacity-100" : "border-slate-100 opacity-70"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-xl flex-shrink-0">
          🚗
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-800">
              {req.vehiclePlate}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[req.status]}`}
            >
              {req.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {req.requesterName} · {req.requesterPhone}
          </p>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
          {timeAgo(req.createdAt)}
        </span>
      </div>

      {/* Detail row */}
      <div className="flex gap-4 text-xs text-slate-600 border-t border-slate-100 pt-2">
        <span>
          🏢 <span className="font-medium">{req.rwaName}</span>
        </span>
        <span>
          🕐 <span className="font-medium">{req.durationHours}h</span>
        </span>
      </div>

      {/* Action buttons — only for PENDING */}
      {isPending && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onDecision(req, "ACCEPTED")}
            disabled={isActing}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
          >
            {isActing ? "…" : "✅ Accept"}
          </button>
          <button
            onClick={() => onDecision(req, "DECLINED")}
            disabled={isActing}
            className="flex-1 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 text-xs font-semibold py-2 rounded-xl border border-red-200 transition-colors"
          >
            {isActing ? "…" : "✗ Decline"}
          </button>
        </div>
      )}
    </div>
  );
}
