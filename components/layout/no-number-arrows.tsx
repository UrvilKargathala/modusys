"use client";

import { useEffect } from "react";

// In a number box the Up / Down arrow keys would add or take off 1 (W 333 -> 334 by accident). Every number field in the app
// should keep exactly what was typed, so the two keys do nothing there. Typing and the spin buttons are left alone.
export function NoNumberArrows() {
  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.target instanceof HTMLInputElement && e.target.type === "number") e.preventDefault();
    };
    document.addEventListener("keydown", stop);
    return () => document.removeEventListener("keydown", stop);
  }, []);
  return null;
}
