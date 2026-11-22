export const instant = false;

import { Suspense } from "react";
import db, { type Spot } from "@/lib/db";
import SpotCard from "@/components/SpotCard";
import FilterBar from "@/components/FilterBar";
import ChatWidget from "@/components/ChatWidget";

interface HomeProps {
  searchParams: Promise<{
    area?: string;
    vehicle_size?: string;
    max_rate?: string;
  }>;
}

async function getSpots(filters: {
  area?: string;
  vehicle_size?: string;
  max_rate?: string;
}): Promise<Spot[]> {
  let query = "SELECT * FROM spots WHERE is_available = 1";
  const params: (string | number)[] = [];

  if (filters.area) {
    query += " AND LOWER(area) LIKE LOWER(?)";
    params.push(`%${filters.area}%`);
  }
  if (filters.vehicle_size) {
    query += " AND vehicle_size = ?";
    params.push(filters.vehicle_size);
  }
  if (filters.max_rate) {
    const rate = parseInt(filters.max_rate, 10);
    if (!isNaN(rate)) {
      query += " AND hourly_rate <= ?";
      params.push(rate);
    }
  }

  query += " ORDER BY hourly_rate ASC";
  return db.prepare(query).all(...params) as Spot[];
}

export default async function Home({ searchParams }: HomeProps) {
  const filters = await searchParams;
  const spots = await getSpots(filters);

  const activeFilters = [
    filters.area,
    filters.vehicle_size,
    filters.max_rate ? `max ₹${filters.max_rate}/hr` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border/40 px-4 pb-10 pt-14 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Two-column split: headline left, stat strip right */}
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">

            <div className="max-w-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                Bengaluru · Peer-to-Peer Parking
              </p>
              <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
                Find a spot.<br />
                <span className="text-primary">Park now.</span>
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
                Real driveways from real hosts across the city.
                Book in under a minute, no app needed.
              </p>
            </div>

            {/* Stat strip */}
            <div className="flex shrink-0 gap-8 lg:gap-12 lg:pb-1">
              {[
                { value: spots.length.toString(), label: "spots available" },
                { value: "₹15", label: "cheapest per hour" },
                { value: "8", label: "neighbourhoods" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col">
                  <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filter bar — sits flush below hero copy */}
          <div className="mt-8 rounded-xl border border-border/50 bg-card p-4">
            <Suspense fallback={null}>
              <FilterBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── Listings ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Row header */}
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {activeFilters.length > 0
              ? `${spots.length} result${spots.length !== 1 ? "s" : ""} · ${activeFilters.join(" · ")}`
              : `${spots.length} spot${spots.length !== 1 ? "s" : ""} available`}
          </h2>
        </div>

        {spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-24 text-center">
            <p className="text-base font-semibold">No spots match your filters.</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Widen the area, change the vehicle type, or raise the max rate.
            </p>
          </div>
        ) : (
          <div className="grid gap-px bg-border/30 rounded-xl overflow-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {spots.map((spot) => (
              <SpotCard key={spot.id} spot={spot} />
            ))}
          </div>
        )}
      </section>

      {/* parkingBob AI Chat */}
      <ChatWidget />
    </div>
  );
}
