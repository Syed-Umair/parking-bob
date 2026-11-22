"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface AddSpotModalProps {
  open: boolean;
  onClose: () => void;
  hostName: string;
}

const BENGALURU_AREAS = [
  "Koramangala",
  "Indiranagar",
  "MG Road",
  "Whitefield",
  "Jayanagar",
  "HSR Layout",
  "Malleshwaram",
  "Electronic City",
  "Bellandur",
  "BTM Layout",
  "Marathahalli",
  "Yelahanka",
  "JP Nagar",
  "Bannerghatta Road",
  "Hebbal",
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
function fmt(h: number) {
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:00 ${period}`;
}

export default function AddSpotModal({ open, onClose, hostName }: AddSpotModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [startHour, setStartHour] = useState("8");
  const [endHour, setEndHour] = useState("20");
  const [vehicleSize, setVehicleSize] = useState("car");
  const [hourlyRate, setHourlyRate] = useState("");
  const [amenities, setAmenities] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !area || !address.trim() || !hourlyRate) {
      toast.error("Please fill in all required fields");
      return;
    }
    const rate = parseInt(hourlyRate, 10);
    if (isNaN(rate) || rate < 1) {
      toast.error("Hourly rate must be a positive number");
      return;
    }
    if (parseInt(startHour) >= parseInt(endHour)) {
      toast.error("End hour must be after start hour");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          area,
          address: address.trim(),
          start_hour: parseInt(startHour),
          end_hour: parseInt(endHour),
          vehicle_size: vehicleSize,
          hourly_rate: rate,
          amenities: amenities.trim(),
          host_name: hostName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to list spot");
        return;
      }

      toast.success("Your spot is live! 🎉");
      // Reset form
      setTitle("");
      setArea("");
      setAddress("");
      setStartHour("8");
      setEndHour("20");
      setVehicleSize("car");
      setHourlyRate("");
      setAmenities("");
      onClose();
      router.refresh(); // re-fetch server component data
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List your parking spot</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Earn extra income by renting out your driveway or garage.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div>
            <Label htmlFor="spot-title">
              Spot title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="spot-title"
              placeholder="e.g. Shaded Driveway near Forum Mall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Area + Address */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="spot-area">
                Area <span className="text-destructive">*</span>
              </Label>
              <Select value={area} onValueChange={(v) => v && setArea(v)}>
                <SelectTrigger id="spot-area" className="mt-1">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {BENGALURU_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vehicle-size">
                Vehicle size <span className="text-destructive">*</span>
              </Label>
              <Select
                value={vehicleSize}
                onValueChange={(v) => v && setVehicleSize(v)}
              >
                <SelectTrigger id="vehicle-size" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bike">Bike 🏍️</SelectItem>
                  <SelectItem value="car">Car 🚗</SelectItem>
                  <SelectItem value="suv">SUV 🚙</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="spot-address">
              Full address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="spot-address"
              placeholder="e.g. 7th Block, Koramangala, Bengaluru 560095"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
          </div>

          <Separator />

          {/* Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-start-hour">Available from</Label>
              <Select
                value={startHour}
                onValueChange={(v) => v && setStartHour(v)}
              >
                <SelectTrigger id="add-start-hour" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.slice(0, 23).map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {fmt(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="add-end-hour">Available until</Label>
              <Select
                value={endHour}
                onValueChange={(v) => v && setEndHour(v)}
              >
                <SelectTrigger id="add-end-hour" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.slice(1).map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {fmt(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rate */}
          <div>
            <Label htmlFor="hourly-rate">
              Hourly rate (₹) <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">
                ₹
              </span>
              <Input
                id="hourly-rate"
                type="number"
                min={1}
                placeholder="e.g. 40"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Amenities */}
          <div>
            <Label htmlFor="amenities">
              Amenities{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (comma-separated, optional)
              </span>
            </Label>
            <Input
              id="amenities"
              placeholder="e.g. CCTV, Covered, EV Charging"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Listing…" : "List my spot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
