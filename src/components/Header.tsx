"use client";

import { useState } from "react";
import { useAuth, useClerk, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Car, Plus } from "lucide-react";
import AddSpotModal from "./AddSpotModal";

export default function Header() {
  const { isSignedIn } = useAuth();
  const { openSignIn, user } = useClerk();
  const [addSpotOpen, setAddSpotOpen] = useState(false);

  function handleListSpot() {
    if (!isSignedIn) {
      openSignIn({});
      return;
    }
    setAddSpotOpen(true);
  }

  const hostName =
    user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress ?? "Host";

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <Car className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              parkingBob
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop label */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleListSpot}
              className="hidden text-xs sm:inline-flex"
            >
              List your spot
            </Button>

            {/* Mobile icon */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleListSpot}
              aria-label="List your spot"
              className="sm:hidden h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {isSignedIn ? (
              <UserButton />
            ) : (
              <Button
                size="sm"
                onClick={() => openSignIn({})}
                className="text-xs"
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      {isSignedIn && (
        <AddSpotModal
          open={addSpotOpen}
          onClose={() => setAddSpotOpen(false)}
          hostName={hostName}
        />
      )}
    </>
  );
}
