"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [area, setArea] = useState(searchParams.get("area") ?? "");
  const [vehicleSize, setVehicleSize] = useState(
    searchParams.get("vehicle_size") ?? ""
  );
  const [maxRate, setMaxRate] = useState(searchParams.get("max_rate") ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (area.trim()) params.set("area", area.trim());
    if (vehicleSize && vehicleSize !== "all") params.set("vehicle_size", vehicleSize);
    if (maxRate.trim()) params.set("max_rate", maxRate.trim());
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    setArea("");
    setVehicleSize("");
    setMaxRate("");
    router.push(pathname);
  }

  const hasFilters = area.trim() || (vehicleSize && vehicleSize !== "all") || maxRate.trim();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

      {/* Area */}
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          Area
        </span>
        <Input
          placeholder="Koramangala, HSR Layout…"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="pl-12 text-sm"
        />
      </div>

      {/* Vehicle */}
      <div className="w-full sm:w-36">
        <Select
          value={vehicleSize || "all"}
          onValueChange={(v) => setVehicleSize(v === null || v === "all" ? "" : v)}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Any vehicle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any vehicle</SelectItem>
            <SelectItem value="bike">Bike</SelectItem>
            <SelectItem value="car">Car</SelectItem>
            <SelectItem value="suv">SUV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Max rate */}
      <div className="relative w-full sm:w-32">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          Max ₹
        </span>
        <Input
          type="number"
          placeholder="80"
          value={maxRate}
          onChange={(e) => setMaxRate(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="pl-12 text-sm"
        />
      </div>

      {/* Buttons */}
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={applyFilters} className="text-xs">
          Search
        </Button>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="text-xs text-muted-foreground">
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
