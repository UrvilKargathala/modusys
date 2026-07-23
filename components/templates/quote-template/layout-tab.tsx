"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PdfField } from "@/components/templates/quote-template/pdf-field";
import { quoteTemplateStore, useQuoteTemplateSettings } from "@/lib/store/quote-template-store";

export function LayoutTab({ disabled }: { disabled: boolean }) {
  const settings = useQuoteTemplateSettings();
  const { layout } = settings;
  const [saveTick, setSaveTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bump = () => setSaveTick((t) => t + 1);

  const handleUpload = (file: File) => {
    quoteTemplateStore.updateLayout({
      referencePdfName: file.name,
      referencePdfUploadedAt: new Date().toISOString(),
    });
    bump();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-body font-medium text-grey-700">Reference PDF</span>
        {layout.referencePdfName ? (
          <div className="flex items-center gap-3 rounded-lg border border-grey-100 bg-card p-3">
            <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded border border-grey-100 bg-light-600">
              <FileText className="h-4 w-4 text-grey-400" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-body font-medium text-grey-700">{layout.referencePdfName}</span>
              <span className="text-xs font-body text-grey-400">
                Uploaded {layout.referencePdfUploadedAt ? new Date(layout.referencePdfUploadedAt).toLocaleDateString("en-IN") : "—"}
              </span>
            </div>
            {!disabled && (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Replace
                </Button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => {
                    quoteTemplateStore.updateLayout({ referencePdfName: null, referencePdfUploadedAt: null });
                    bump();
                  }}
                  className="rounded p-1.5 text-grey-400 hover:bg-error-transparent hover:text-error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-grey-200 bg-light-600 p-6 text-center hover:border-primary"
            >
              <Upload className="h-5 w-5 text-grey-400" />
              <span className="text-sm font-body text-grey-500">Drop a reference PDF here, or click to browse</span>
            </button>
          )
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-grey-100 bg-card p-3 lg:max-w-2xl">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-body font-medium text-grey-700">Show Unit-Level Pricing</span>
          <span className="text-xs font-body text-grey-400">
            When off, only the Final Offer Amount is shown — individual unit prices are hidden from the client.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={layout.showUnitLevelPricing}
          disabled={disabled}
          onClick={() => {
            quoteTemplateStore.updateLayout({ showUnitLevelPricing: !layout.showUnitLevelPricing });
            bump();
          }}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            layout.showUnitLevelPricing ? "bg-primary" : "bg-grey-200"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              layout.showUnitLevelPricing ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PdfField label="Installation & Freight Text" htmlFor="qt-freight" savedTick={saveTick}>
          <Input
            id="qt-freight"
            disabled={disabled}
            key={String(layout.installationFreightText)}
            defaultValue={layout.installationFreightText}
            onBlur={(e) => {
              quoteTemplateStore.updateLayout({ installationFreightText: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="Quote Validity Text" htmlFor="qt-validity" savedTick={saveTick}>
          <Input
            id="qt-validity"
            disabled={disabled}
            key={String(layout.quoteValidityText)}
            defaultValue={layout.quoteValidityText}
            onBlur={(e) => {
              quoteTemplateStore.updateLayout({ quoteValidityText: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="Cheque Payable To" htmlFor="qt-cheque" savedTick={saveTick}>
          <Input
            id="qt-cheque"
            disabled={disabled}
            key={String(layout.chequePayableTo)}
            defaultValue={layout.chequePayableTo}
            onBlur={(e) => {
              quoteTemplateStore.updateLayout({ chequePayableTo: e.target.value });
              bump();
            }}
          />
        </PdfField>
      </div>
    </div>
  );
}
