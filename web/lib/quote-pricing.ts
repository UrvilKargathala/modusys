// Web-only pricing helpers (they read the Material Spec store). The pure totals maths lives in shared/quote-pricing.ts.
import type { QuoteUnit } from "@shared/mock/quote";
import { materialSpecStore } from "@/lib/store/material-spec-store";

// Aluminium Profile shutters come as a complete pre-made unit — Width,
// Height, Qty, Thickness, Amount, Rate, colours, everything — so a Shutter
// Finish change (which carries plywood/BWP-style thickness/colour values)
// must never touch them.
export function isAluminiumProfileRawMaterial(rawMaterialTypeId?: string): boolean {
  if (!rawMaterialTypeId) return false;
  const item = materialSpecStore.getSnapshot().find((i) => i.id === rawMaterialTypeId);
  return item?.name.trim().toLowerCase() === "aluminium profile";
}

export * from "@shared/quote-pricing";

// The Material Specification section's Shutter Finish selection is the
// single source of truth for every Shutter (External Finish) row's External
// Colour across every Unit/Cabinet — changing it re-syncs all of them
// immediately, rather than each Shutter row picking its own colour.
export type ShutterFinishOverrides = {
  shutterFinishId?: string;
  shutterFinishThicknessId?: string;
  shutterFinishRawMaterialId?: string;
  shutterFinishInternalColourId?: string;
  shutterFinishExternalColourId?: string;
};

export function applyShutterFinishToUnits(units: QuoteUnit[], overrides: ShutterFinishOverrides): QuoteUnit[] {
  return units.map((unit) => ({
    ...unit,
    cabinets: unit.cabinets.map((cabinet) => ({
      ...cabinet,
      externalFinishes: cabinet.externalFinishes.map((item) =>
        isAluminiumProfileRawMaterial(item.rawMaterialTypeId)
          ? item
          : {
              ...item,
              ...(overrides.shutterFinishThicknessId && { thicknessId: overrides.shutterFinishThicknessId }),
              ...(overrides.shutterFinishRawMaterialId && { rawMaterialTypeId: overrides.shutterFinishRawMaterialId }),
              ...(overrides.shutterFinishInternalColourId && { internalColourId: overrides.shutterFinishInternalColourId }),
              ...((overrides.shutterFinishExternalColourId || overrides.shutterFinishId) && {
                externalColourId: overrides.shutterFinishExternalColourId || overrides.shutterFinishId,
              }),
            }
      ),
    })),
  }));
}
