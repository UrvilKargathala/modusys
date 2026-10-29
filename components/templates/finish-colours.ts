"use client";

import { materialSpecStore, useMaterialItems } from "@/lib/store/material-spec-store";

type ColourList = "internal-colour" | "external-colour";

// Furniture Price List: Internal / External Colour are picked from Templates > Material Library > Finish Material, but a price row
// keeps the Internal / External Colour entry of that name (added to that list when it's missing). Quote lines, Unit Types and Cabinet
// Types find their price by those entries, so they keep matching.
export function useFinishColours() {
  const finishes = useMaterialItems("finish-material");
  const internal = useMaterialItems("internal-colour");
  const external = useMaterialItems("external-colour");
  const nameOfColour = (list: ColourList, colourId: string) => (list === "internal-colour" ? internal : external).find((m) => m.id === colourId)?.name ?? "";
  // The Finish Material entry with the colour's name ("" when there is none).
  const finishIdOf = (list: ColourList, colourId: string) => {
    const n = nameOfColour(list, colourId).trim().toLowerCase();
    return n ? finishes.find((f) => f.name.trim().toLowerCase() === n)?.id ?? "" : "";
  };
  // The colour entry for a picked Finish Material name, added to the colour list when it isn't there yet.
  const colourIdFor = (list: ColourList, finishId: string) => {
    const name = finishes.find((f) => f.id === finishId)?.name.trim() ?? "";
    if (!name) return "";
    const hit = materialSpecStore.getSnapshot().find((m) => m.category === list && !m.deleted && m.name.trim().toLowerCase() === name.toLowerCase());
    return hit ? hit.id : materialSpecStore.createItem({ category: list, name, description: "" }).id;
  };
  return { nameOfColour, finishIdOf, colourIdFor };
}
