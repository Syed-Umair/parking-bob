"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Totals {
  allotted: number;
  pending: number;
  declined: number;
  revenueINR: number;
  total: number;
}

interface SlotStat {
  rwaSlotId: string;
  rwaName: string;
  allotted: number;
  revenueINR: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// Inline SVG bar chart — no external deps
function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="truncate max-w-[200px]" title={d.label}>{d.label}</span>
            <span className="font-semibold text-slate-700 ml-2 whitespace-nowrap">{fmtINR(d.value)}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${d.color}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "bg-teal-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-emerald-500",
];

export default function DashboardPage() {
  const [totals, setTotals]       = useState<Totals | null>(null);
  const [bySlot, setBySlot]       = useState<SlotStat[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/seed"); // ensure demo data
      const res  = await fetch("/api/analytics");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setTotals(data.totals);
      setBySlot(data.bySlot);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh every 30 s
  useEffect(() => {
    const id = setInterval(fetchAnalytics, 30_000);
    return () => clearInterval(id);
  }, [fetchAnalytics]);

  const acceptRate =
    totals && totals.total > 0
      ? Math.round((totals.allotted / totals.total) * 100)
      : 0;

  const chartData = bySlot.map((s, i) => ({
    label: s.rwaName.replace(" Visitor Parking", "").replace(" Visitor Hub", ""),
    value: s.revenueINR,
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      {/* Top bar */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white/70 hover:text-white text-lg">←</Link>
        <div className="flex-1">
          <div className="font-bold text-sm">Analytics Dashboard</div>
          <div className="text-slate-400 text-xs">
            Allotments &amp; Revenue · Bengaluru Parking Bob
          </div>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="text-xs text-slate-300 hover:text-white font-medium disabled:opacity-40"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Sub-header: last refresh */}
      <div className="bg-slate-800 pb-4 px-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI: Slots allotted */}
        <div className="rounded-xl bg-teal-600 p-4 text-white">
          <div className="text-3xl font-bold">
            {loading ? "—" : (totals?.allotted ?? 0)}
          </div>
          <div className="text-teal-100 text-xs mt-1 font-medium">Slots Allotted</div>
          <div className="text-teal-200 text-xs mt-0.5">accepted requests</div>
        </div>

        {/* KPI: Revenue */}
        <div className="rounded-xl bg-emerald-600 p-4 text-white">
          <div className="text-3xl font-bold leading-tight">
            {loading ? "—" : fmtINR(totals?.revenueINR ?? 0)}
          </div>
          <div className="text-emerald-100 text-xs mt-1 font-medium">Total Revenue</div>
          <div className="text-emerald-200 text-xs mt-0.5">from accepted bookings</div>
        </div>

        {/* KPI: Pending */}
        <div className="rounded-xl bg-white/10 p-4 text-white">
          <div className="text-3xl font-bold">
            {loading ? "—" : (totals?.pending ?? 0)}
          </div>
          <div className="text-slate-200 text-xs mt-1 font-medium">Pending</div>
          <div className="text-slate-300 text-xs mt-0.5">awaiting owner decision</div>
        </div>

        {/* KPI: Acceptance rate */}
        <div className="rounded-xl bg-white/10 p-4 text-white">
          <div className="text-3xl font-bold">
            {loading ? "—" : `${acceptRate}%`}
          </div>
          <div className="text-slate-200 text-xs mt-1 font-medium">Acceptance Rate</div>
          <div className="text-slate-300 text-xs mt-0.5">
            {loading ? "" : `${totals?.total ?? 0} total requests`}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* ── Revenue by RWA ─────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              Revenue by RWA Hub
            </h2>
            {lastRefresh && (
              <span className="text-xs text-slate-400">
                {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-1 animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <div className="text-3xl mb-2">📊</div>
              No accepted requests yet.
              <br />
              Revenue will appear here once owners accept parking requests.
            </div>
          ) : (
            <BarChart data={chartData} />
          )}
        </section>

        {/* ── Per-slot breakdown table ────────────────────────────────────── */}
        {!loading && bySlot.length > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                Per-Hub Breakdown
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {bySlot.map((s, i) => (
                <div key={s.rwaSlotId} className="px-5 py-3 flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.rwaName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-emerald-700">{fmtINR(s.revenueINR)}</div>
                    <div className="text-xs text-slate-400">{s.allotted} allotted</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Status distribution ─────────────────────────────────────────── */}
        {!loading && totals && totals.total > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              Request Status Distribution
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Accepted", value: totals.allotted,  pct: Math.round((totals.allotted  / totals.total) * 100), bar: "bg-emerald-500" },
                { label: "Pending",  value: totals.pending,   pct: Math.round((totals.pending   / totals.total) * 100), bar: "bg-amber-400"  },
                { label: "Declined", value: totals.declined,  pct: Math.round((totals.declined  / totals.total) * 100), bar: "bg-red-400"    },
              ].map((item) => (
                <div key={item.label} className="text-center space-y-1">
                  <div className="text-2xl font-bold text-slate-800">{item.value}</div>
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <div className="text-xs text-slate-400">{item.pct}%</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!loading && !error && totals?.total === 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-3">
            <div className="text-4xl">📋</div>
            <p className="font-semibold text-slate-700">No parking requests yet</p>
            <p className="text-sm text-slate-500">
              Go to{" "}
              <Link href="/park" className="text-blue-600 underline font-medium">Find Parking</Link>
              {" "}to submit a request, then accept it from the{" "}
              <Link href="/owner-portal" className="text-teal-700 underline font-medium">Owner Portal</Link>
              {" "}to see revenue here.
            </p>
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href="/park"
            className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            🅿️ Find &amp; Request Slots
          </Link>
          <Link
            href="/owner-portal"
            className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-center text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
          >
            🏘️ Owner Portal
          </Link>
        </div>
      </div>
    </main>
  );
}
