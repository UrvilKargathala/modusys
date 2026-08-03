"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Mail, AtSign, ExternalLink, Pencil, Trash2, X, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArchitectFormDialog } from "@/components/architects/architect-form-dialog";
import { DeleteArchitectDialog } from "@/components/architects/delete-architect-dialog";
import { useOpenArchitectId, architectPanelStore } from "@/lib/store/architect-panel-store";
import { useArchitects, architectsStore } from "@/lib/store/architects-store";
import { getArchitectLinkedQuotes } from "@/lib/mock/customer-detail";
import { fullName } from "@/lib/mock/architects";
import { getCurrentUser } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";

// Lighter-weight than the Customer Detail Sidebar (no chat/media — an
// architect's record is just contact details + the business they've
// referred), but same Sheet pattern, header layout, and role gating.
export function ArchitectPanel() {
  const architectId = useOpenArchitectId();
  const architects = useArchitects();
  const architect = architectId ? architects.find((a) => a.id === architectId) : undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const quotes = architect ? getArchitectLinkedQuotes(architect) : [];

  const handleDelete = () => {
    if (!architect) return;
    const deleted = architect;
    architectsStore.deleteArchitect(deleted.id);
    setDeleteOpen(false);
    architectPanelStore.close();
    toastStore.show(`${fullName(deleted)} deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => architectsStore.restoreArchitect(deleted.id) },
    });
  };

  return (
    <>
      <Sheet open={architectId !== null} onOpenChange={(open) => !open && architectPanelStore.close()}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 data-[side=right]:w-screen sm:data-[side=right]:w-full sm:data-[side=right]:max-w-[420px]"
          showCloseButton={false}
        >
          {architect && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-grey-100 px-5 py-4">
                <div className="flex flex-col gap-1">
                  <h2 className="font-heading text-lg font-bold text-grey-900">{fullName(architect)}</h2>
                  {architect.company && (
                    <span className="text-sm font-body text-grey-500">{architect.company}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {architect.mobile && (
                    <a
                      href={`tel:${architect.mobile}`}
                      aria-label="Call architect"
                      className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    aria-label="Email architect"
                    className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label="Edit architect"
                      onClick={() => setEditOpen(true)}
                      className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      aria-label="Delete architect"
                      onClick={() => setDeleteOpen(true)}
                      className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <SheetClose
                    aria-label="Close panel"
                    className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-grey-700"
                  >
                    <X className="h-4 w-4" />
                  </SheetClose>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
                {architect.partners.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-body text-grey-500">Partners</span>
                    <span className="text-sm font-body text-grey-900">{architect.partners.join(", ")}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-body text-grey-500">Mobile</span>
                    <span className="text-sm font-number text-grey-900">{architect.mobile || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-body text-grey-500">Office</span>
                    <span className="text-sm font-number text-grey-900">{architect.office || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-body text-grey-500">Instagram</span>
                    {architect.instagram ? (
                      <a
                        href={`https://instagram.com/${architect.instagram.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-body text-primary hover:underline"
                      >
                        <AtSign className="h-3.5 w-3.5" />
                        {architect.instagram}
                      </a>
                    ) : (
                      <span className="text-sm font-body text-grey-300">—</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-body text-grey-500">Birthday</span>
                    <span className="text-sm font-body text-grey-900">
                      {architect.birthdayMonth ? `${architect.birthdayMonth} ${architect.birthdayDay}` : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-body text-grey-500">Address</span>
                  <span className="text-sm font-body text-grey-900">
                    {[architect.address, architect.city, architect.state, architect.postcode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-body text-grey-500">Linked Quotes / Customers</span>
                  {quotes.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-grey-100 py-8 text-center">
                      <Building2 className="h-5 w-5 text-grey-300" />
                      <span className="text-sm font-body text-grey-400">No referred business yet.</span>
                    </div>
                  ) : (
                    quotes.map((quote) => (
                      <Link
                        key={quote.id}
                        href="/quotes"
                        className="flex items-center justify-between gap-2 rounded-lg border border-grey-100 bg-light-600/60 px-3 py-2 transition-colors hover:bg-light-600"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-number font-medium text-grey-800">{quote.quoteNumber}</span>
                          <span className="text-xs font-body text-grey-400">{quote.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={quote.status} />
                          <span className="text-sm font-number font-semibold text-grey-800">
                            ₹{quote.finalOfferLakh.toFixed(1)}L
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-grey-300" />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {architect && (
        <ArchitectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          architect={architect}
          onSubmit={(values) => architectsStore.updateArchitect(architect.id, values)}
        />
      )}

      <DeleteArchitectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        architect={architect ?? null}
        onConfirm={handleDelete}
      />
    </>
  );
}
