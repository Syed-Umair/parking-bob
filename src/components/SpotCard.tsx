"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Shield, Zap } from "lucide-react";
import type { Spot } from "@/lib/db";
import BookingModal from "./BookingModal";

interface SpotCardProps {
  spot: Spot;
}

const VEHICLE_LABEL: Record<string, string> = {
  bike: "Bike",
  car: "Car",
  suv: "SUV",
};

const AMENITY_ICON: Record<string, React.ReactNode> = {
  "EV Charging": <Zap className="h-2.5 w-2.5" />,
  "CCTV": <Shield className="h-2.5 w-2.5" />,
};

function fmt12(h: number) {
  const period = h < 12 ? "am" : "pm";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}${period}`;
}

export default function SpotCard({ spot }: SpotCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const amenities = spot.amenities
    ? spot.amenities.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  return (
    <>
      <div className="group flex flex-col bg-card px-5 py-5 transition-colors hover:bg-card/80">

        {/* Top row: area badge + vehicle */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {spot.area}
          </div>
          <Badge
            variant="outline"
            className="border-border/60 text-[10px] font-semibold uppercase tracking-wide px-2 py-0"
          >
            {VEHICLE_LABEL[spot.vehicle_size] ?? spot.vehicle_size}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug text-foreground">
          {spot.title}
        </h3>

        {/* Address */}
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {spot.address}
        </p>

        {/* Hours */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {fmt12(spot.start_hour)} – {fmt12(spot.end_hour)}
          </span>
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {AMENITY_ICON[a]}
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Footer: price + host + CTA */}
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <div className="text-xl font-bold tabular-nums text-foreground">
              ₹{spot.hourly_rate}
              <span className="text-xs font-normal text-muted-foreground">/hr</span>
            </div>
            <p className="text-[10px] text-muted-foreground">by {spot.host_name}</p>
          </div>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="text-xs"
          >
            Book
          </Button>
        </div>
      </div>

      <BookingModal
        spot={spot}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
