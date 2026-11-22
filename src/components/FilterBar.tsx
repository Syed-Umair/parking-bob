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
import { Search } from "lucide-react";

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [area, setArea] = useState(searchParams.get("area") ?? "");
  const [vehicleSize, setVehicleSize] = useState(
    searchParams.get("vehicle_size") ?? ""
  );
  const [maxRate, setMaxRate] = useState(
    searchParams.get("max_rate") ?? ""
  );

  function applyFilters() {
    const params = new URLSearchParams();
    if (area.trim()) params.set("area", area.trim());
    if (vehicleSize && vehicleSize !== "all") params.set("vehicle_size", vehicleSize);
    if (maxRate.trim()) params.set("max_rate", maxRate.trim());
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setArea("");
    setVehicleSize("");
    setMaxRate("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Area
        </label>
        <Input
          placeholder="e.g. Koramangala"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
      </div>

      <div className="w-full sm:w-40">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Vehicle
        </label>
        <Select
          value={vehicleSize || "all"}
          onValueChange={(v) => setVehicleSize(v === null || v === "all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="bike">Bike</SelectItem>
            <SelectItem value="car">Car</SelectItem>
            <SelectItem value="suv">SUV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-36">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Max rate (₹/hr)
        </label>
        <Input
          type="number"
          placeholder="e.g. 50"
          value={maxRate}
          onChange={(e) => setMaxRate(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={applyFilters} className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Search
        </Button>
        <Button variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>
    </div>
  );
}
