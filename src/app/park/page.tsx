"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RwaSlot {
  _id: string;
  rwaName: string;
  locality: string;
  location: { type: "Point"; coordinates: [number, number] };
  hourlyRateINR: number;
  availableSlots: number;
  totalSlots: number;
  openHours: string;
}

// ─── Locality filters (map to seed coordinates for demo) ─────────────────────

const LOCALITIES: {
  label: string;
  lat: number;
  lng: number;
  emoji: string;
}[] = [
  { label: "HSR Layout", lat: 12.9121, lng: 77.6446, emoji: "🏘️" },
  { label: "Indiranagar", lat: 12.9784, lng: 77.6408, emoji: "🛍️" },
  { label: "Koramangala", lat: 12.9352, lng: 77.6245, emoji: "☕" },
  { label: "Bellandur", lat: 12.9259, lng: 77.6762, emoji: "🏢" },
  { label: "Whitefield", lat: 12.9698, lng: 77.7499, emoji: "🏙️" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distLabel(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

function slotColor(available: number, total: number) {
  const pct = available / total;
  if (pct === 0) return { bg: "bg-red-100", text: "text-red-700", bar: "bg-red-400" };
  if (pct < 0.3) return { bg: "bg-amber-100", text: "text-amber-700", bar: "bg-amber-400" };
  return { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" };
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Request form state shape ─────────────────────────────────────────────────

interface RequestForm {
  slot: RwaSlot;
  requesterName: string;
  requesterPhone: string;
  vehiclePlate: string;
  durationHours: number;
}

export default function ParkPage() {
  const [activeLocality, setActiveLocality] = useState(LOCALITIES[0]);
  const [slots, setSlots] = useState<RwaSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Request-a-slot flow state
  const [requestForm, setRequestForm] = useState<RequestForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ slotId: string; rwaName: string } | null>(null);

  const fetchSlots = useCallback(async (loc: typeof LOCALITIES[0]) => {
    setLoading(true);
    setError("");
    setSlots([]);
    try {
      // Ensure demo data exists
      await fetch("/api/seed");
      const res = await fetch(
        `/api/slots?lat=${loc.lat}&lng=${loc.lng}&radius=8000`
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSlots(data.slots);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load slots.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots(activeLocality);
  }, [activeLocality, fetchSlots]);

  function openRequestForm(slot: RwaSlot) {
    setError("");
    setRequestForm({
      slot,
      requesterName: "",
      requesterPhone: "",
      vehiclePlate: "",
      durationHours: 1,
    });
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestForm) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/parking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rwaSlotId:      requestForm.slot._id,
          rwaName:        requestForm.slot.rwaName,
          requesterName:  requestForm.requesterName,
          requesterPhone: requestForm.requesterPhone,
          vehiclePlate:   requestForm.vehiclePlate,
          durationHours:  requestForm.durationHours,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSubmitted({ slotId: requestForm.slot._id, rwaName: requestForm.slot.rwaName });
      setRequestForm(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Request form overlay ────────────────────────────────────────────────────

  if (requestForm) {
    const { slot } = requestForm;
    return (
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setRequestForm(null)} className="text-white/80 hover:text-white text-lg">←</button>
          <div>
            <div className="font-bold text-sm">Request a Parking Slot</div>
            <div className="text-blue-200 text-xs truncate max-w-xs">{slot.rwaName}</div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-1">
            <h3 className="font-semibold text-slate-800 text-sm">{slot.rwaName}</h3>
            <p className="text-xs text-slate-500">{slot.locality} · ₹{slot.hourlyRateINR}/hr · {slot.openHours}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              {slot.availableSlots} slots free
            </p>
          </div>

          <form onSubmit={handleSubmitRequest} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-slate-700 text-sm">Your Details</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  required
                  value={requestForm.requesterName}
                  onChange={(e) => setRequestForm((f) => f && { ...f, requesterName: e.target.value })}
                  placeholder="e.g. Arjun Sharma"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  required
                  value={requestForm.requesterPhone}
                  onChange={(e) => setRequestForm((f) => f && { ...f, requesterPhone: e.target.value })}
                  placeholder="+91-98****1234"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Plate</label>
                <input
                  required
                  value={requestForm.vehiclePlate}
                  onChange={(e) => setRequestForm((f) => f && { ...f, vehiclePlate: e.target.value })}
                  placeholder="KA-01-MJ-1234"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (hours)</label>
                <select
                  value={requestForm.durationHours}
                  onChange={(e) => setRequestForm((f) => f && { ...f, durationHours: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800 bg-white"
                >
                  {[1, 2, 3, 4, 6, 8].map((h) => (
                    <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""} · ₹{slot.hourlyRateINR * h}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? "Sending Request…" : "📨 Send Parking Request to Owner"}
            </button>
            <p className="text-xs text-slate-400 text-center">
              The RWA owner will accept or decline your request. You'll see the status on confirmation.
            </p>
          </form>
        </div>
      </main>
    );
  }

  // ─── Submission confirmation ──────────────────────────────────────────────────

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSubmitted(null)} className="text-white/80 hover:text-white text-lg">←</button>
          <div className="font-bold text-sm">Request Submitted</div>
        </div>
        <div className="max-w-md mx-auto px-4 pt-8 space-y-6 text-center">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 space-y-4">
            <div className="text-5xl">📨</div>
            <h2 className="text-xl font-bold text-slate-800">Request Sent!</h2>
            <p className="text-sm text-slate-500">{submitted.rwaName}</p>
            <p className="text-sm text-slate-600">
              Your parking request has been submitted to the RWA owner.
              They will review and accept or decline it shortly.
            </p>
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-xs text-teal-700">
              💡 The owner can review your request at the{" "}
              <a href="/owner-portal" className="font-semibold underline">Owner Portal</a>.
            </div>
          </div>
          <button
            onClick={() => setSubmitted(null)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            ← Find Another Slot
          </button>
        </div>
      </main>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Top bar */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white/80 hover:text-white text-lg">←</Link>
        <div>
          <div className="font-bold text-sm">Find RWA Parking</div>
          <div className="text-blue-200 text-xs">Bengaluru Visitor Slots</div>
        </div>
      </div>

      {/* Locality quick-filters */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500 font-medium mb-2">LOCALITY</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {LOCALITIES.map((loc) => (
            <button
              key={loc.label}
              onClick={() => setActiveLocality(loc)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeLocality.label === loc.label
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{loc.emoji}</span>
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">

        {/* Status line */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {loading
              ? "Searching…"
              : `${slots.length} slot hub${slots.length !== 1 ? "s" : ""} near ${activeLocality.label}`}
          </span>
          <button
            onClick={() => fetchSlots(activeLocality)}
            className="text-blue-600 font-medium hover:text-blue-800 text-xs"
          >
            ↺ Refresh
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Slot cards */}
        {!loading &&
          slots.map((slot) => {
            const dist = haversineMetres(
              activeLocality.lat, activeLocality.lng,
              slot.location.coordinates[1],
              slot.location.coordinates[0]
            );
            const color = slotColor(slot.availableSlots, slot.totalSlots);
            const fillPct = Math.round((slot.availableSlots / slot.totalSlots) * 100);
            const isRequested = submitted?.slotId === slot._id;

            return (
              <div
                key={slot._id}
                className={`rounded-2xl bg-white border shadow-sm p-5 space-y-3 transition-shadow hover:shadow-md ${
                  isRequested ? "border-teal-400 ring-1 ring-teal-300" : "border-slate-200"
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug">{slot.rwaName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{slot.locality}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap font-medium">
                    📍 {distLabel(dist)}
                  </span>
                </div>

                {/* Slot availability bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Availability</span>
                    <span className={`font-semibold ${color.text}`}>
                      {slot.availableSlots}/{slot.totalSlots} free
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${color.bar}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    💰 <span className="font-semibold text-slate-700">₹{slot.hourlyRateINR}/hr</span>
                  </span>
                  <span className="flex items-center gap-1">
                    🕐 <span>{slot.openHours}</span>
                  </span>
                </div>

                {/* CTA */}
                {submitted?.slotId === slot._id ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-center">
                    <span className="text-sm font-semibold text-teal-700">📨 Request Sent — Awaiting Owner Approval</span>
                  </div>
                ) : (
                  <button
                    onClick={() => openRequestForm(slot)}
                    disabled={slot.availableSlots <= 0}
                    className={`w-full text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                      slot.availableSlots <= 0
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {slot.availableSlots <= 0
                      ? "🚫 Full — No Slots Available"
                      : "📨 Request Visitor Slot"}
                  </button>
                )}
              </div>
            );
          })}

        {/* Empty state */}
        {!loading && !error && slots.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">No slots found near {activeLocality.label}</p>
            <p className="text-sm mt-1">Try seeding demo data from the home page.</p>
            <Link href="/" className="mt-3 inline-block text-blue-600 text-sm font-medium underline">
              Go to Home →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
