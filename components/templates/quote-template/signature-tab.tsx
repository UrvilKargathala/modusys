"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PdfField } from "@/components/templates/quote-template/pdf-field";
import { quoteTemplateStore, useQuoteTemplateSettings } from "@/lib/store/quote-template-store";

export function SignatureTab({ disabled }: { disabled: boolean }) {
  const settings = useQuoteTemplateSettings();
  const { signature } = settings;
  const [saveTick, setSaveTick] = useState(0);
  const bump = () => setSaveTick((t) => t + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PdfField label="Company Name (Signature)" htmlFor="qt-sig-company" savedTick={saveTick}>
          <Input
            id="qt-sig-company"
            disabled={disabled}
            key={String(signature.companyName)}
            defaultValue={signature.companyName}
            onBlur={(e) => {
              quoteTemplateStore.updateSignature({ companyName: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="Signature Title" htmlFor="qt-sig-title" savedTick={saveTick}>
          <Input
            id="qt-sig-title"
            disabled={disabled}
            key={String(signature.signatureTitle)}
            defaultValue={signature.signatureTitle}
            onBlur={(e) => {
              quoteTemplateStore.updateSignature({ signatureTitle: e.target.value });
              bump();
            }}
          />
        </PdfField>
      </div>

      <PdfField label="Additional Footer Text (Optional)" htmlFor="qt-sig-footer" savedTick={saveTick}>
        <textarea
          id="qt-sig-footer"
          disabled={disabled}
          key={String(signature.additionalFooterText)}
          defaultValue={signature.additionalFooterText}
          rows={2}
          className="w-full rounded-lg border border-grey-100 bg-transparent px-2.5 py-1.5 text-sm font-body text-grey-700 outline-none focus:border-primary disabled:opacity-50 lg:max-w-2xl"
          onBlur={(e) => {
            quoteTemplateStore.updateSignature({ additionalFooterText: e.target.value });
            bump();
          }}
        />
      </PdfField>

      <div className="flex flex-col gap-1.5 rounded-lg border border-grey-100 bg-light-600 p-4 lg:max-w-2xl">
        <span className="text-xs font-body font-medium text-grey-400">How this renders on the PDF</span>
        <div className="mt-2 flex flex-col items-end gap-8 text-right">
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-body text-grey-700">For, {signature.companyName}</span>
            {signature.additionalFooterText && (
              <span className="max-w-xs text-xs font-body text-grey-400">{signature.additionalFooterText}</span>
            )}
          </div>
          <span className="text-sm font-body font-medium text-grey-700">{signature.signatureTitle}</span>
        </div>
      </div>
    </div>
  );
}
