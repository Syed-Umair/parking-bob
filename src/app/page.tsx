export const instant = false;

import { Suspense } from "react";
import db, { type Spot } from "@/lib/db";
import SpotCard from "@/components/SpotCard";
import FilterBar from "@/components/FilterBar";
import ChatWidget from "@/components/ChatWidget";
import { MapPin } from "lucide-react";

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
    filters.max_rate ? `≤₹${filters.max_rate}/hr` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-background via-card to-background px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <MapPin className="h-3 w-3" />
              Bengaluru&apos;s Peer-to-Peer Parking
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              Park smarter.{" "}
              <span className="text-primary">Live better.</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-muted-foreground">
              Book a driveway in seconds. Host your space, earn extra income.
              No apps, no queues — just tap and park.
            </p>
          </div>

          {/* Filter bar */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-lg shadow-black/20">
            <Suspense fallback={null}>
              <FilterBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {spots.length} Spot{spots.length !== 1 ? "s" : ""} Available
            </h2>
            {activeFilters.length > 0 && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Filtered by: {activeFilters.join(" · ")}
              </p>
            )}
          </div>
        </div>

        {spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <p className="text-lg font-medium">No spots found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filters or clearing them entirely.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
