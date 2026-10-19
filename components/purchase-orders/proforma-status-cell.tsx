"use client";

import { useMemo } from "react";
import { StatusMenu } from "@/components/shared/status-menu";
import { useProformaStatusChange } from "@/components/purchase-orders/proforma-status-change";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { statusColourStyle } from "@/lib/mock/material-spec";
import { asPoStatus, poStatusLabel, poStatusList, type PurchaseOrder } from "@/lib/purchase-order";

// A Proforma Invoice's status pill for the Production and Packing tabs: the same list and colours as the Proforma Invoices list; picking a
// status opens the shared date / notes popup (and then the matching tab).
export function ProformaStatusCell({ po }: { po: PurchaseOrder }) {
  const ask = useProformaStatusChange();
  const materials = useMaterialItems("proforma-order-status");
  const orders = usePurchaseOrders();
  const proformaOrders = useMemo(() => orders.filter((o) => !!o.material.proforma), [orders]);
  const statuses = useMemo(() => poStatusList(proformaOrders, materials.map((m) => m.name)), [proformaOrders, materials]);
  const colours = useMemo(() => Object.fromEntries(materials.map((m) => [asPoStatus(m.name), m.description])), [materials]);
  return (
    <StatusMenu
      label={`Status of ${po.poNumber || "this invoice"}`}
      value={asPoStatus(po.status)}
      options={statuses.map((st) => ({ value: st, label: poStatusLabel(st), className: colours[st] ? "border" : "bg-grey-transparent text-grey-700", style: statusColourStyle(colours[st]) }))}
      onChange={(v) => ask(po, v)}
      onAdd={(name) => {
        if (!materials.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) materialSpecStore.createItem({ category: "proforma-order-status", name, description: "#5D6772" });
        ask(po, asPoStatus(name));
      }}
    />
  );
}
