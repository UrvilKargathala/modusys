"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PdfField } from "@/components/templates/quote-template/pdf-field";
import { quoteTemplateStore, useQuoteTemplateSettings } from "@/lib/store/quote-template-store";

export function BrandingTab({ disabled }: { disabled: boolean }) {
  const settings = useQuoteTemplateSettings();
  const { branding } = settings;
  const [saveTick, setSaveTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bump = () => setSaveTick((t) => t + 1);

  const handleLogoFile = (file: File) => {
    if (file.size > 300 * 1024) {
      window.alert("Logo must be under 300KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      quoteTemplateStore.updateBranding({ logoDataUrl: reader.result as string });
      bump();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-body font-medium text-grey-700">Company Logo</span>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-grey-100 bg-light-600">
            {branding.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
            ) : (
              <ImageIcon className="h-5 w-5 text-grey-300" />
            )}
          </div>
          {!disabled && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {branding.logoDataUrl ? "Replace" : "Upload"}
              </Button>
              {branding.logoDataUrl && (
                <button
                  type="button"
                  aria-label="Remove logo"
                  onClick={() => {
                    quoteTemplateStore.updateBranding({ logoDataUrl: null });
                    bump();
                  }}
                  className="rounded p-1.5 text-grey-400 hover:bg-error-transparent hover:text-error"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
        />
        <p className="text-xs font-body text-grey-400">Max 300KB, JPG preferred, recommended 200×100px.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PdfField label="Company Name" htmlFor="qt-company-name" savedTick={saveTick}>
          <Input
            id="qt-company-name"
            disabled={disabled}
            key={String(branding.companyName)}
            defaultValue={branding.companyName}
            onBlur={(e) => {
              quoteTemplateStore.updateBranding({ companyName: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="Tagline" htmlFor="qt-tagline" savedTick={saveTick}>
          <Input
            id="qt-tagline"
            disabled={disabled}
            key={String(branding.tagline)}
            defaultValue={branding.tagline}
            onBlur={(e) => {
              quoteTemplateStore.updateBranding({ tagline: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="Address" htmlFor="qt-address" savedTick={saveTick}>
          <Input
            id="qt-address"
            disabled={disabled}
            key={String(branding.address)}
            defaultValue={branding.address}
            onBlur={(e) => {
              quoteTemplateStore.updateBranding({ address: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="City / State / Pincode" htmlFor="qt-address2" savedTick={saveTick}>
          <Input
            id="qt-address2"
            disabled={disabled}
            key={String(branding.addressLine2)}
            defaultValue={branding.addressLine2}
            onBlur={(e) => {
              quoteTemplateStore.updateBranding({ addressLine2: e.target.value });
              bump();
            }}
          />
        </PdfField>

        <PdfField label="Email" htmlFor="qt-email" savedTick={saveTick}>
          <Input
            id="qt-email"
            type="email"
            disabled={disabled}
            key={String(branding.email)}
            defaultValue={branding.email}
            onBlur={(e) => {
              quoteTemplateStore.updateBranding({ email: e.target.value });
              bump();
            }}
          />
        </PdfField>
        <PdfField label="Phone" htmlFor="qt-phone" savedTick={saveTick}>
          <Input
            id="qt-phone"
            disabled={disabled}
            className="font-number"
            key={String(branding.phone)}
            defaultValue={branding.phone}
            onBlur={(e) => {
              quoteTemplateStore.updateBranding({ phone: e.target.value });
              bump();
            }}
          />
        </PdfField>
      </div>

      <div className="rounded-lg border border-warning-900/30 bg-warning-transparent p-3 lg:max-w-2xl">
        <PdfField
          label="Default Markup Multiplier"
          htmlFor="qt-markup"
          helperText="Used to calculate customer price from unit cost. Pricing-critical — changes apply to every new quote."
          disabled={disabled}
          savedTick={saveTick}
        >
          <Input
            id="qt-markup"
            type="number"
            step="0.01"
            disabled={disabled}
            key={String(branding.defaultMarkupMultiplier)}
            defaultValue={branding.defaultMarkupMultiplier}
            className="max-w-32 font-number"
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value > 0) {
                quoteTemplateStore.updateBranding({ defaultMarkupMultiplier: value });
                bump();
              }
            }}
          />
        </PdfField>
      </div>
    </div>
  );
}
