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
import { useUnitTypes, unitTypeStore } from "@/lib/store/unit-type-store";

// The Unit Type's "Components visible" tick, shown on the PO's cabinet header (matched by the cabinet's unit name).
// It is the same saved tick as Templates > Unit Type > Basic Info: unticked keeps the cabinet title only (no component rows)
// in the purchase order PDFs, for every PO that uses that unit type. Nothing shows for a cabinet with no matching unit type.
// Changing it shows a message first and only applies when confirmed.
export function PoComponentsToggle({ unitName }: { unitName?: string }) {
  const unitTypes = useUnitTypes();
  const [confirming, setConfirming] = useState(false);
  const unitType = unitName ? unitTypes.find((u) => !u.deleted && u.name === unitName) : undefined;
  if (!unitType) return null;
  const on = unitType.countComponents !== false;
  return (
    <>
      <label
        className="flex h-8 cursor-pointer items-center px-1"
        title={`Components visible: ${on ? "ticked, its components print in the PDF" : "unticked, only the cabinet title prints"}. Same tick as Templates > Unit Type for "${unitType.name}", so it applies to every PO using it.`}
      >
        <input
          type="checkbox"
          aria-label={`Components visible for ${unitType.name}`}
          checked={on}
          // Not applied yet: the dialog below asks first.
          onChange={() => setConfirming(true)}
          className="h-4 w-4 cursor-pointer accent-slate"
        />
      </label>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{on ? "Hide the components?" : "Show the components?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {on
                ? `Only the cabinet title of "${unitType.name}" will print in the purchase order PDFs, without its component rows, and its Comp. count will show 0.`
                : `The component rows of "${unitType.name}" will print again in the purchase order PDFs, and its Comp. count will show its components.`}{" "}
              This is the unit type&apos;s own setting, so it applies to every purchase order that uses it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                unitTypeStore.setCountComponents(unitType.id, !on);
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
