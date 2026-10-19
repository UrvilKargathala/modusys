"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PackageCheck, Copy, Download, FileText, FileSpreadsheet, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PACKING_PDF_PARTS, PO_EXCEL_PARTS, PO_PDF_PARTS, partLabel } from "@/lib/purchase-order-export";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import type { PurchaseOrder } from "@/lib/purchase-order";

// The row action icons shared by the PO lists and the Packing tab: View, (Packing), Download menu, Copy, Delete.
// viewHref: where the eye icon goes (default: the PO / invoice editor).
export function PoRowActions({ po, proforma, base, showPacking = false, viewHref }: { po: PurchaseOrder; proforma: boolean; base: string; showPacking?: boolean; viewHref?: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Copy = a new Pending PO with the same vendor, material and rows; the PO number is left blank to type.
  const copyPo = async () => {
    const { id: _id, createdAt: _c, vendorName: _v, status: _s, lines, ...rest } = po;
    try {
      const created = await purchaseOrdersStore.create({ ...rest, poNumber: "", lines: lines.map(({ id: _l, ...l }) => l) });
      toastStore.show("Purchase order copied", "success");
      router.push(`${base}/${created.id}`);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not copy", "error");
    }
  };
  return (
    <div className="flex items-center justify-end">
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="View"
                          onClick={() => router.push(viewHref ?? `${base}/${po.id}`)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>View</TooltipContent>
                      </Tooltip>
                      {showPacking && proforma && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Packing"
                            onClick={() => router.push(`/proforma-invoices/packing/${po.id}`)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <PackageCheck className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Packing</TooltipContent>
                        </Tooltip>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="Download"
                          title="Download"
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Download className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-max min-w-72">
                          <DropdownMenuGroup>
                          <DropdownMenuLabel>PDF</DropdownMenuLabel>
                          {(proforma ? [...PO_PDF_PARTS.filter((p) => p.key !== "full" && p.key !== "ledger").flatMap((p) => (p.key === "components" ? [p, ...PACKING_PDF_PARTS] : [p])), { key: "cutlist" as const, label: "Cut List" }] : PO_PDF_PARTS).map((p) => (
                            <DropdownMenuItem key={`pdf-${p.key}`} className="gap-2 whitespace-nowrap" onClick={() => window.open(`/purchase-orders/${po.id}/pdf${p.key === "full" ? "" : `?part=${p.key}`}`, "_blank")}>
                              <FileText className="h-4 w-4 text-grey-400" />
                              {partLabel(p.label, proforma)}
                            </DropdownMenuItem>
                          ))}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                          <DropdownMenuLabel>Excel</DropdownMenuLabel>
                          {PO_EXCEL_PARTS.filter((p) => !proforma || p.key !== "full" && p.key !== "ledger").map((p) => (
                            <DropdownMenuItem key={`xls-${p.key}`} className="gap-2 whitespace-nowrap" onClick={() => window.open(`/purchase-orders/${po.id}/pdf?format=excel${p.key === "full" ? "" : `&part=${p.key}`}`, "_blank")}>
                              <FileSpreadsheet className="h-4 w-4 text-grey-400" />
                              {partLabel(p.label, proforma)}
                            </DropdownMenuItem>
                          ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Copy"
                          onClick={() => void copyPo()}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Copy className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Delete"
                          onClick={() => setConfirmDelete(true)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${proforma ? "proforma invoice" : "PO"} ${po.poNumber || "(no number)"}?`}
        description="This removes it and its lines. The quote it came from is not affected."
        onConfirm={async () => {
          try {
            await purchaseOrdersStore.remove(po.id);
            toastStore.show("Deleted", "success");
          } catch (e) {
            toastStore.show(e instanceof Error ? e.message : "Could not delete", "error");
          }
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
