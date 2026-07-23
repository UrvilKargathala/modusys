"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PdfField } from "@/components/templates/quote-template/pdf-field";
import { quoteTemplateStore, useQuoteTemplateSettings } from "@/lib/store/quote-template-store";

function maskAccountNumber(value: string) {
  if (value.length <= 4) return value;
  return "•".repeat(value.length - 4) + value.slice(-4);
}

export function BankingTab({ disabled }: { disabled: boolean }) {
  const settings = useQuoteTemplateSettings();
  const { banking } = settings;
  const [saveTick, setSaveTick] = useState(0);
  const [revealAccount, setRevealAccount] = useState(false);
  const bump = () => setSaveTick((t) => t + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PdfField label="Bank Name" htmlFor="qt-bank-name" savedTick={saveTick}>
          <Input
            id="qt-bank-name"
            disabled={disabled}
            key={String(banking.bankName)}
            defaultValue={banking.bankName}
            onBlur={(e) => {
              quoteTemplateStore.updateBanking({ bankName: e.target.value });
              bump();
            }}
          />
        </PdfField>
        <PdfField label="Branch" htmlFor="qt-branch" savedTick={saveTick}>
          <Input
            id="qt-branch"
            disabled={disabled}
            key={String(banking.branch)}
            defaultValue={banking.branch}
            onBlur={(e) => {
              quoteTemplateStore.updateBanking({ branch: e.target.value });
              bump();
            }}
          />
        </PdfField>
        <PdfField label="Account Name" htmlFor="qt-account-name" savedTick={saveTick}>
          <Input
            id="qt-account-name"
            disabled={disabled}
            key={String(banking.accountName)}
            defaultValue={banking.accountName}
            onBlur={(e) => {
              quoteTemplateStore.updateBanking({ accountName: e.target.value });
              bump();
            }}
          />
        </PdfField>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:max-w-2xl">
        <PdfField label="Account Number" htmlFor="qt-account-number" savedTick={saveTick}>
          <div className="relative">
            <Input
              id="qt-account-number"
              disabled={disabled}
              type={revealAccount ? "text" : "password"}
              key={String(banking.accountNumber)}
              defaultValue={banking.accountNumber}
              className="pr-8"
              onBlur={(e) => {
                quoteTemplateStore.updateBanking({ accountNumber: e.target.value });
                bump();
              }}
            />
            <button
              type="button"
              aria-label={revealAccount ? "Hide account number" : "Reveal account number"}
              onClick={() => setRevealAccount((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-grey-400 hover:text-grey-700"
            >
              {revealAccount ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </PdfField>
        <PdfField label="IFSC Code" htmlFor="qt-ifsc" savedTick={saveTick}>
          <Input
            id="qt-ifsc"
            disabled={disabled}
            key={String(banking.ifscCode)}
            defaultValue={banking.ifscCode}
            onBlur={(e) => {
              quoteTemplateStore.updateBanking({ ifscCode: e.target.value.toUpperCase() });
              bump();
            }}
          />
        </PdfField>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-grey-100 bg-light-600 p-3 lg:max-w-2xl">
        <span className="text-xs font-body font-medium text-grey-400">How this renders on the PDF</span>
        <p className="text-sm font-body text-grey-700">
          BANK DETAILS: {banking.bankName} ({banking.branch}) | {banking.accountName} | CURRENT A/C No:{" "}
          {maskAccountNumber(banking.accountNumber)} | IFSC code: {banking.ifscCode}
        </p>
      </div>
    </div>
  );
}
