"use client";

import { useEffect } from "react";
import { applyPalette, loadPalette } from "@/lib/palette";

// Puts the saved Colour Palette (if any) on the page when the app opens.
export function PaletteApplier() {
  useEffect(() => {
    applyPalette(loadPalette());
  }, []);
  return null;
}
