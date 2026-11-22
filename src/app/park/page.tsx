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

export default function ParkPage() {
  const [activeLocality, setActiveLocality] = useState(LOCALITIES[0]);
  const [slots, setSlots] = useState<RwaSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookedId, setBookedId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null); // which slot is being booked
  const [qrPass, setQrPass] = useState<{ slotId: string; rwaName: string } | null>(null);

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

  async function handleBook(slot: RwaSlot) {
    if (slot.availableSlots <= 0) return;
    setBookingId(slot._id);
    try {
      const res = await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot._id, action: "BOOK" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setBookedId(slot._id);
      setQrPass({ slotId: slot._id, rwaName: slot.rwaName });
      setSlots((prev) =>
        prev.map((s) => (s._id === slot._id ? data.slot : s))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Booking failed.");
    } finally {
      setBookingId(null);
    }
  }

  // ─── QR Pass Modal ──────────────────────────────────────────────────────────

  if (qrPass) {
    const passCode = `BLR-PASS-${qrPass.slotId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    return (
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setQrPass(null)} className="text-white/80 hover:text-white text-lg">←</button>
          <div className="font-bold text-sm">Gate QR Pass</div>
        </div>
        <div className="max-w-md mx-auto px-4 pt-8 space-y-6 text-center">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 space-y-4">
            <div className="text-5xl">🎟️</div>
            <h2 className="text-xl font-bold text-slate-800">Visitor Slot Booked!</h2>
            <p className="text-sm text-slate-500">{qrPass.rwaName}</p>

            {/* Fake QR code using CSS grid pattern */}
            <div className="mx-auto w-40 h-40 grid grid-cols-10 gap-0.5 p-3 bg-white border-2 border-slate-800 rounded-lg">
              {Array.from({ length: 100 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${
                    // deterministic pattern from passCode chars
                    (passCode.charCodeAt(i % passCode.length) + i) % 3 === 0
                      ? "bg-slate-800"
                      : "bg-white"
                  }`}
                />
              ))}
            </div>

            <div className="font-mono text-sm bg-slate-100 rounded-lg px-4 py-2 text-slate-700 tracking-widest">
              {passCode}
            </div>
            <p className="text-xs text-slate-400">
              Show this QR at the gate. Valid for 2 hours from booking.
            </p>
          </div>
          <button
            onClick={() => setQrPass(null)}
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
            const isBooked = bookedId === slot._id;
            const isBooking = bookingId === slot._id;

            return (
              <div
                key={slot._id}
                className={`rounded-2xl bg-white border shadow-sm p-5 space-y-3 transition-shadow hover:shadow-md ${
                  isBooked ? "border-emerald-400 ring-1 ring-emerald-300" : "border-slate-200"
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
                {isBooked ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-center">
                    <span className="text-sm font-semibold text-emerald-700">✅ Slot Booked — Pass Generated</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleBook(slot)}
                    disabled={slot.availableSlots <= 0 || !!bookingId}
                    className={`w-full text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                      slot.availableSlots <= 0
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                    }`}
                  >
                    {isBooking
                      ? "Booking…"
                      : slot.availableSlots <= 0
                      ? "🚫 Full — No Slots Available"
                      : "🅿️ Book Visitor Slot & Generate Gate QR Pass"}
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
