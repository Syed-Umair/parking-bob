"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Zap } from "lucide-react";
import type { Spot } from "@/lib/db";
import BookingModal from "./BookingModal";

interface SpotCardProps {
  spot: Spot;
}

const VEHICLE_EMOJI: Record<string, string> = {
  bike: "🏍️",
  car: "🚗",
  suv: "🚙",
};

export default function SpotCard({ spot }: SpotCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const amenities = spot.amenities ? spot.amenities.split(",").map((a) => a.trim()) : [];

  return (
    <>
      <Card className="flex flex-col overflow-hidden border border-border/60 bg-card transition-shadow hover:shadow-lg hover:shadow-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{spot.title}</CardTitle>
            <span className="text-xl" title={spot.vehicle_size}>
              {VEHICLE_EMOJI[spot.vehicle_size] ?? "🚗"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{spot.area}</span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {spot.address}
          </p>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {spot.start_hour}:00 – {spot.end_hour}:00
            </span>
          </div>

          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((a) => (
                <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {a === "EV Charging" && <Zap className="h-2.5 w-2.5 mr-0.5" />}
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border/40 pt-3">
          <div>
            <span className="text-xl font-bold text-primary">₹{spot.hourly_rate}</span>
            <span className="text-xs text-muted-foreground">/hr</span>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Book Now
          </Button>
        </CardFooter>
      </Card>

      <BookingModal
        spot={spot}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
