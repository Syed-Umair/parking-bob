"use client";

import { useAuth, useClerk, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";

export default function Header() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  return (
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

        {/* Auth */}
        <div className="flex items-center gap-3">
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
  );
}
