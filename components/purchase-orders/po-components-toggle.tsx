"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import type { PoCabinet } from "@/lib/purchase-order";

// The Unit Type's "Components visible" tick, shown on the PO's cabinet header (matched by the cabinet's unit name).
// It is the same saved tick as Templates > Unit Type > Basic Info: unticked keeps the cabinet title only (no component rows)
// in the purchase order PDFs, for every PO that uses that unit type. Nothing shows for a cabinet with no matching unit type.
// Changing it shows a message first and only applies when confirmed.
export function PoComponentsToggle({ unitName, cabinet, onCabinetChange }: { unitName?: string; cabinet: PoCabinet; onCabinetChange: (cabinet: PoCabinet) => void }) {
  const unitTypes = useUnitTypes();
  const [confirming, setConfirming] = useState(false);
  const unitType = unitName ? unitTypes.find((u) => !u.deleted && u.name === unitName) : undefined;
  if (!unitType) return null;
  // This cabinet's own tick; until it is set, it shows the Unit Type's tick. Changing it only changes this cabinet.
  const on = cabinet.componentsVisible ?? unitType.countComponents !== false;
  return (
    <>
      <label
        className="flex h-8 cursor-pointer items-center px-1"
        title={`Components visible: ${on ? "ticked, its components print in the PDF" : "unticked, only the cabinet title prints"}. Only this cabinet; Templates > Unit Type keeps its own tick.`}
      >
        <input
          type="checkbox"
          aria-label={`Components visible for ${unitType.name}`}
          checked={on}
          // Not applied yet: the dialog below asks first.
          onChange={() => setConfirming(true)}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      </label>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{on ? "Hide the components?" : "Show the components?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {on
                ? `Only the title of this "${unitType.name}" cabinet will print in the purchase order PDFs, without its component rows.`
                : `The component rows of this "${unitType.name}" cabinet will print again in the purchase order PDFs.`}{" "}
              This applies to this cabinet only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onCabinetChange({ ...cabinet, componentsVisible: !on });
                setConfirming(false);
              }}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
