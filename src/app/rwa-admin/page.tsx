"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RwaSlot {
  _id: string;
  rwaName: string;
  locality: string;
  hourlyRateINR: number;
  availableSlots: number;
  totalSlots: number;
  openHours: string;
  location: { type: "Point"; coordinates: [number, number] };
}

interface Incident {
  _id: string;
  qrToken: string;
  issueType: "BLOCKING_GATE" | "DOUBLE_PARKED" | "NO_PARKING_ZONE";
  escalationStage: "WHATSAPP_NUDGE" | "MASKED_CALL" | "ALT_SLOT_OFFERED" | "RESOLVED";
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ISSUE_LABELS: Record<string, string> = {
  BLOCKING_GATE: "🚧 Blocking Gate",
  DOUBLE_PARKED: "🚗🚗 Double Parked",
  NO_PARKING_ZONE: "🚫 No-Parking Zone",
};

const STAGE_COLORS: Record<string, string> = {
  WHATSAPP_NUDGE: "bg-green-100 text-green-700",
  MASKED_CALL: "bg-amber-100 text-amber-700",
  ALT_SLOT_OFFERED: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-slate-100 text-slate-500",
};

const STAGE_LABELS: Record<string, string> = {
  WHATSAPP_NUDGE: "💬 WhatsApp Nudge",
  MASKED_CALL: "📞 Masked Call",
  ALT_SLOT_OFFERED: "🅿️ Alt Slot Offered",
  RESOLVED: "✅ Resolved",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function slotFillPct(available: number, total: number) {
  return total > 0 ? Math.round((available / total) * 100) : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RwaAdminPage() {
  const [slots, setSlots] = useState<RwaSlot[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch all slots (use a central Bengaluru coord + large radius)
  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    setError("");
    try {
      await fetch("/api/seed"); // ensure demo data
      const res = await fetch(
        "/api/slots?lat=12.9352&lng=77.6245&radius=20000"
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSlots(data.slots);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load slots.");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // ── Fetch all incidents
  const fetchIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const res = await fetch("/api/incidents");
      const data = await res.json();
      if (data.ok) {
        setIncidents(
          data.incidents.sort(
            (a: Incident, b: Incident) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
    fetchIncidents();
  }, [fetchSlots, fetchIncidents]);

  // Auto-refresh incidents every 15s
  useEffect(() => {
    const id = setInterval(() => {
      fetchIncidents();
      setLastRefresh(new Date());
    }, 15_000);
    return () => clearInterval(id);
  }, [fetchIncidents]);

  // ── Adjust slot count
  async function adjustSlot(slot: RwaSlot, action: "BOOK" | "RELEASE") {
    setAdjustingId(slot._id);
    setError("");
    try {
      const res = await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot._id, action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSlots((prev) =>
        prev.map((s) => (s._id === slot._id ? data.slot : s))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Adjustment failed.");
    } finally {
      setAdjustingId(null);
    }
  }

  // ── Escalate incident to RESOLVED
  async function resolveIncident(incident: Incident) {
    try {
      // Advance through stages to RESOLVED if not already there
      const NEXT_STAGE: Record<string, string> = {
        WHATSAPP_NUDGE: "MASKED_CALL",
        MASKED_CALL: "ALT_SLOT_OFFERED",
        ALT_SLOT_OFFERED: "RESOLVED",
      };
      const targetStage = "RESOLVED";
      const res = await fetch("/api/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: incident._id,
          escalationStage: NEXT_STAGE[incident.escalationStage] || targetStage,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIncidents((prev) =>
          prev.map((i) => (i._id === incident._id ? data.incident : i))
        );
      }
    } catch {
      // non-fatal
    }
  }

  const activeIncidents = incidents.filter(
    (i) => i.escalationStage !== "RESOLVED"
  );
  const resolvedToday = incidents.filter(
    (i) => i.escalationStage === "RESOLVED"
  ).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      {/* Top bar */}
      <div className="bg-violet-700 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white/80 hover:text-white text-lg">←</Link>
        <div className="flex-1">
          <div className="font-bold text-sm">RWA Facility Admin</div>
          <div className="text-violet-200 text-xs">Bengaluru Parking Dashboard</div>
        </div>
        <button
          onClick={() => { fetchSlots(); fetchIncidents(); setLastRefresh(new Date()); }}
          className="text-xs text-violet-200 hover:text-white font-medium"
        >
          ↺ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="bg-violet-700 px-4 pb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/10 p-3 text-center">
          <div className="text-2xl font-bold text-white">
            {slots.reduce((s, r) => s + r.availableSlots, 0)}
          </div>
          <div className="text-xs text-violet-200 mt-0.5">Free Slots</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3 text-center">
          <div className="text-2xl font-bold text-white">{activeIncidents.length}</div>
          <div className="text-xs text-violet-200 mt-0.5">Active Incidents</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3 text-center">
          <div className="text-2xl font-bold text-white">{resolvedToday}</div>
          <div className="text-xs text-violet-200 mt-0.5">Resolved</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* ── Slot management ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              Visitor Slot Management
            </h2>
            <span className="text-xs text-slate-400">{slots.length} hubs</span>
          </div>

          {loadingSlots ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-6 bg-slate-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => {
                const pct = slotFillPct(slot.availableSlots, slot.totalSlots);
                const isAdjusting = adjustingId === slot._id;
                const barColor =
                  pct === 0
                    ? "bg-red-400"
                    : pct < 30
                    ? "bg-amber-400"
                    : "bg-emerald-500";

                return (
                  <div
                    key={slot._id}
                    className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-3"
                  >
                    {/* Row 1: name + locality + rate */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-800 text-sm leading-snug">
                          {slot.rwaName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {slot.locality} · {slot.openHours}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-violet-700">
                          ₹{slot.hourlyRateINR}/hr
                        </div>
                        <div className="text-xs text-slate-400">hourly rate</div>
                      </div>
                    </div>

                    {/* Row 2: availability bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Visitor Slots</span>
                        <span
                          className={`font-semibold ${
                            pct === 0
                              ? "text-red-600"
                              : pct < 30
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {slot.availableSlots}/{slot.totalSlots} free
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Row 3: +/- controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 flex-1">
                        Reclaim / Release visitor slot:
                      </span>
                      <button
                        onClick={() => adjustSlot(slot, "BOOK")}
                        disabled={isAdjusting || slot.availableSlots <= 0}
                        title="Reclaim slot (mark occupied)"
                        className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-30 text-red-600 font-bold text-lg transition-colors flex items-center justify-center"
                      >
                        −
                      </button>
                      <div className="w-10 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-mono text-sm font-bold text-slate-700">
                        {isAdjusting ? "…" : slot.availableSlots}
                      </div>
                      <button
                        onClick={() => adjustSlot(slot, "RELEASE")}
                        disabled={isAdjusting || slot.availableSlots >= slot.totalSlots}
                        title="Release slot (mark free)"
                        className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 text-emerald-600 font-bold text-lg transition-colors flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loadingSlots && slots.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No slot hubs found. Seed demo data first.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Incident feed ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              Double-Parking Incident Feed
            </h2>
            <span className="text-xs text-slate-400">
              Refreshed{" "}
              {lastRefresh?.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }) ?? "—"}
            </span>
          </div>

          {loadingIncidents && incidents.length === 0 ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="rounded-2xl bg-white border border-slate-200 p-4 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-slate-400 text-sm">
              <div className="text-3xl mb-2">🌿</div>
              No incidents reported yet.
              <br />
              Scan a windshield QR to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => {
                const isActive = inc.escalationStage !== "RESOLVED";
                return (
                  <div
                    key={inc._id}
                    className={`rounded-2xl bg-white border shadow-sm p-4 transition-opacity ${
                      isActive ? "border-slate-200 opacity-100" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                            {inc.qrToken}
                          </span>
                          <span className="text-xs text-slate-500">
                            {ISSUE_LABELS[inc.issueType] ?? inc.issueType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              STAGE_COLORS[inc.escalationStage]
                            }`}
                          >
                            {STAGE_LABELS[inc.escalationStage]}
                          </span>
                          <span className="text-xs text-slate-400">
                            {timeAgo(inc.createdAt)}
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <button
                          onClick={() => resolveIncident(inc)}
                          className="flex-shrink-0 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Escalate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href="/scan/BLR-004"
            className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
          >
            📷 Test QR Scan<br />
            <span className="text-xs font-normal text-orange-500">BLR-004 (Blocking)</span>
          </Link>
          <Link
            href="/park"
            className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            🅿️ Slot Finder<br />
            <span className="text-xs font-normal text-blue-500">View as commuter</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
