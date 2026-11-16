"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuotePdfSheet } from "@/components/templates/quote-template/quote-pdf-sheet";
import { toastStore } from "@/lib/store/toast-store";
import type { QuoteTemplateSettings } from "@shared/mock/quote-template";

export function PreviewModal({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: QuoteTemplateSettings;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto overflow-x-hidden p-0">
        <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-2 border-b border-grey-100 bg-card px-6 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle>Quote PDF Preview</DialogTitle>
            <span className="text-xs font-body text-grey-400">
              Sample data — real-quote preview arrives with the Quotes module
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 pr-8">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                toastStore.show("PDF generation runs server-side (Puppeteer) — wire-up pending backend phase.", "success")
              }
            >
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="mx-auto my-6 w-full px-6">
          <QuotePdfSheet settings={settings} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
