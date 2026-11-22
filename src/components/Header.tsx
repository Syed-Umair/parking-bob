"use client";

import { useState } from "react";
import { useAuth, useClerk, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Car, PlusCircle } from "lucide-react";
import AddSpotModal from "./AddSpotModal";

export default function Header() {
  const { isSignedIn, userId } = useAuth();
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
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight text-foreground">
                parkingBob
              </span>
              <span className="text-[10px] text-muted-foreground">
                Smarter Streets, Better Living
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleListSpot}
              className="hidden sm:inline-flex gap-1.5"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              List your spot
            </Button>

            {isSignedIn ? (
              <UserButton />
            ) : (
              <Button size="sm" onClick={() => openSignIn({})} className="cursor-pointer">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* AddSpot modal — only mounted when signed in */}
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
