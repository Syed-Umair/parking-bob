"use client";

import { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Spot } from "@/lib/db";

interface BookingModalProps {
  spot: Spot;
  open: boolean;
  onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmt(h: number) {
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:00 ${period}`;
}

export default function BookingModal({ spot, open, onClose }: BookingModalProps) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [startHour, setStartHour] = useState<string>(String(spot.start_hour));
  const [endHour, setEndHour] = useState<string>(String(Math.min(spot.start_hour + 1, spot.end_hour)));
  const [loading, setLoading] = useState(false);

  const hours = parseInt(endHour) - parseInt(startHour);
  const totalCost = hours > 0 ? hours * spot.hourly_rate : 0;

  async function handleBook() {
    if (!isSignedIn) {
      openSignIn?.();
      return;
    }
    if (!vehicleNumber.trim() || !driverName.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (parseInt(startHour) >= parseInt(endHour)) {
      toast.error("End time must be after start time");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spot_id: spot.id,
          driver_name: driverName,
          vehicle_number: vehicleNumber,
          start_hour: parseInt(startHour),
          end_hour: parseInt(endHour),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Booking failed");
        return;
      }

      toast.success(
        `Booking confirmed! Code: ${data.booking.booking_code}`,
        { duration: 8000 }
      );
      onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Book Parking Spot</DialogTitle>
          <p className="text-sm text-muted-foreground">{spot.title}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Spot summary */}
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Area</span>
              <span className="font-medium">{spot.area}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-medium text-primary">₹{spot.hourly_rate}/hr</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium capitalize">{spot.vehicle_size}</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start-hour">From</Label>
              <Select value={startHour} onValueChange={(v) => v !== null && setStartHour(v)}>
                <SelectTrigger id="start-hour" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.filter(
                    (h) => h >= spot.start_hour && h < spot.end_hour
                  ).map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {fmt(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="end-hour">To</Label>
              <Select value={endHour} onValueChange={(v) => v !== null && setEndHour(v)}>
                <SelectTrigger id="end-hour" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.filter(
                    (h) => h > spot.start_hour && h <= spot.end_hour
                  ).map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {fmt(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="driver-name">Your Name</Label>
            <Input
              id="driver-name"
              placeholder="e.g. Ravi Kumar"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="vehicle-number">Vehicle Number</Label>
            <Input
              id="vehicle-number"
              placeholder="e.g. KA 01 AB 1234"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="mt-1"
            />
          </div>

          {totalCost > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {hours} hr{hours > 1 ? "s" : ""} × ₹{spot.hourly_rate}/hr
                </span>
                <span className="text-lg font-bold text-primary">
                  ₹{totalCost}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleBook} disabled={loading}>
            {loading ? "Booking…" : isSignedIn ? "Confirm Booking" : "Sign in to Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
