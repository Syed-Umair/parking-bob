"use client";

import { useState } from "react";
import Link from "next/link";

const CARDS = [
  {
    href: "/scan/BLR-001",
    emoji: "📷",
    title: "Scan Windshield QR",
    desc: "Report a blocking or double-parked vehicle using the sticker QR on its windshield.",
    cta: "Scan & Report →",
    bg: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    btn: "bg-orange-500 hover:bg-orange-600",
  },
  {
    href: "/park",
    emoji: "🅿️",
    title: "Find Nearby RWA Parking",
    desc: "Locate verified visitor parking slots in Bengaluru RWA hubs and request a spot.",
    cta: "Find & Request Slots →",
    bg: "from-blue-50 to-sky-50",
    border: "border-blue-200",
    btn: "bg-blue-600 hover:bg-blue-700",
  },
  {
    href: "/owner-portal",
    emoji: "🏘️",
    title: "Owner / Association Portal",
    desc: "RWA owners: review visitor parking requests and accept or decline them in one tap.",
    cta: "Open Owner Portal →",
    bg: "from-teal-50 to-emerald-50",
    border: "border-teal-200",
    btn: "bg-teal-700 hover:bg-teal-800",
  },
  {
    href: "/rwa-admin",
    emoji: "🏢",
    title: "RWA Facility Admin",
    desc: "Manage visitor slot counts, hourly rates, and monitor live double-parking incidents.",
    cta: "Open Dashboard →",
    bg: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    btn: "bg-violet-600 hover:bg-violet-700",
  },
  {
    href: "/dashboard",
    emoji: "📊",
    title: "Analytics Dashboard",
    desc: "See how many slots have been allotted and total revenue generated across all RWA hubs.",
    cta: "View Analytics →",
    bg: "from-slate-50 to-gray-50",
    border: "border-slate-200",
    btn: "bg-slate-700 hover:bg-slate-800",
  },
];

export default function HomePage() {
  const [seedStatus, setSeedStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [seedMsg, setSeedMsg] = useState("");

  async function handleSeed() {
    setSeedStatus("loading");
    try {
      const res = await fetch("/api/seed");
      const data = await res.json();
      if (data.ok) {
        setSeedStatus("success");
        setSeedMsg(
          `✅ Seeded ${data.seeded.vehicles} vehicles + ${data.seeded.rwaSlots} RWA slots`
        );
      } else {
        throw new Error(data.error);
      }
    } catch (e: unknown) {
      setSeedStatus("error");
      setSeedMsg(`❌ ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 text-center">
        <div className="text-5xl mb-3">🚗</div>
        <h1 className="text-4xl font-bold tracking-tight">Parking Bob</h1>
        <p className="mt-2 text-slate-400 text-lg max-w-md mx-auto">
          Bengaluru's hyperlocal parking &amp; double-parking triage platform
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 text-sm">
          {["HSR Layout", "Koramangala", "Indiranagar", "Bellandur", "Whitefield"].map((loc) => (
            <span
              key={loc}
              className="px-3 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium"
            >
              {loc}
            </span>
          ))}
        </div>
      </header>

      {/* Cards */}
      <section className="max-w-5xl mx-auto px-4 py-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <div
            key={c.href}
            className={`rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} p-6 flex flex-col gap-4 shadow-sm`}
          >
            <div className="text-4xl">{c.emoji}</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{c.desc}</p>
            </div>
            <Link
              href={c.href}
              className={`mt-auto inline-block text-center text-white text-sm font-semibold px-5 py-2.5 rounded-xl ${c.btn} transition-colors`}
            >
              {c.cta}
            </Link>
          </div>
        ))}
      </section>

      {/* Seed section */}
      <section className="max-w-md mx-auto px-4 pb-16 text-center">
        <div className="rounded-2xl border border-slate-600 bg-slate-800/60 p-6">
          <p className="text-sm text-slate-400 mb-4">
            First time? Seed realistic Bengaluru demo data into the database.
          </p>
          <button
            onClick={handleSeed}
            disabled={seedStatus === "loading"}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {seedStatus === "loading" ? "Seeding…" : "🌱 Seed Bengaluru Demo Data"}
          </button>
          {seedMsg && (
            <p
              className={`mt-3 text-sm font-medium ${
                seedStatus === "success" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {seedMsg}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
