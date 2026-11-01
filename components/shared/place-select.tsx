"use client";

import { useEffect } from "react";
import { TextReferenceSelect } from "@/components/shared/text-reference-select";
import { materialSpecStore, useMaterialItems } from "@/lib/store/material-spec-store";

// Indian states and union territories: the State list starts with these (a deleted one stays deleted).
const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
let statesSeeded = false;

// City / State box for the Customer, Architect, Vendor and Dealer forms: one shared saved list each (Material Library "city" / "state",
// not shown in Material Spec). Typing a new name adds it; the bin removes it from the list (records that use it keep their text).
export function PlaceSelect({ kind, value, onChange }: { kind: "city" | "state"; value: string; onChange: (name: string) => void }) {
  const items = useMaterialItems(kind);
  useEffect(() => {
    if (kind === "state" && !statesSeeded) {
      statesSeeded = true;
      void materialSpecStore.seedDefaults("state", STATES.map((name) => ({ name, description: "" })));
    }
  }, [kind]);
  const options = items.map((i) => i.name).sort((a, b) => a.localeCompare(b));
  const pick = (name: string) => {
    if (name && !materialSpecStore.isNameTaken(kind, name)) materialSpecStore.createItem({ category: kind, name, description: "" });
    onChange(name);
  };
  const remove = (name: string) => {
    const item = items.find((i) => i.name === name);
    if (item) materialSpecStore.deleteItem(item.id);
  };
  return <TextReferenceSelect label={kind === "city" ? "City" : "State"} options={options} value={value} onChange={pick} onDelete={remove} />;
}
