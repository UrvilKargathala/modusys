"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Eye, Lock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LayoutTab } from "@/components/templates/quote-template/layout-tab";
import { BrandingTab } from "@/components/templates/quote-template/branding-tab";
import { BankingTab } from "@/components/templates/quote-template/banking-tab";
import { NotesTab } from "@/components/templates/quote-template/notes-tab";
import { TermsTab } from "@/components/templates/quote-template/terms-tab";
import { SignatureTab } from "@/components/templates/quote-template/signature-tab";
import { PreviewModal } from "@/components/templates/quote-template/preview-modal";
import { purchaseTemplateStore, quoteTemplateStore } from "@/lib/store/quote-template-store";
import { TemplateStoreContext, useTemplateSettings } from "@/components/templates/quote-template/template-store-context";
import { getCurrentUser } from "@/lib/session";

const subTabs = [
  { value: "layout", label: "Layout" },
  { value: "branding", label: "Branding" },
  { value: "banking", label: "Banking" },
  { value: "notes", label: "Notes" },
  { value: "terms", label: "Terms" },
  { value: "signature", label: "Signature" },
];

// kind "purchase" = the Purchase Template: same tabs, its own saved settings, used by the purchase order PDFs.
export function QuoteTemplateSection({ kind = "quote" }: { kind?: "quote" | "purchase" }) {
  const store = kind === "purchase" ? purchaseTemplateStore : quoteTemplateStore;
  return (
    <TemplateStoreContext.Provider value={store}>
      <TemplateEditor kind={kind} />
    </TemplateStoreContext.Provider>
  );
}

function TemplateEditor({ kind }: { kind: "quote" | "purchase" }) {
  const purchase = kind === "purchase";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The Purchase Template has no Banking tab.
  const tabs = purchase ? subTabs.filter((t) => t.value !== "banking") : subTabs;
  const requested = searchParams.get("qtView") ?? "layout";
  const subTab = tabs.some((t) => t.value === requested) ? requested : "layout";
  const [previewOpen, setPreviewOpen] = useState(false);
  const settings = useTemplateSettings();

  const role = getCurrentUser().role;
  const canView = role !== "staff";
  const canEdit = role === "super-admin" || role === "admin";

  const setSubTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "template");
    params.set("tpl", purchase ? "purchase" : "quote");
    params.set("qtView", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!canView) {
    return (
      <EmptyState
        icon={Lock}
        message={`${purchase ? "Purchase" : "Quote"} Template settings are only available to Super Admin and Admin.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold text-grey-900">{purchase ? "Purchase Template" : "Quote Template"}</h1>
          <p className="text-sm font-body text-grey-400">
            {purchase ? "Configure the branding and clauses that render on every Purchase Order PDF" : "Configure the branding, banking, and clauses that render on every client-facing Quote PDF"}
          </p>
        </div>
        {!purchase && (
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        )}
      </div>

      <Tabs value={subTab} onValueChange={(value) => setSubTab(String(value))}>
        <TabsList className="flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6 w-full rounded-xl border border-grey-100 bg-card p-6">
          <TabsContent value="layout"><LayoutTab disabled={!canEdit} /></TabsContent>
          <TabsContent value="branding"><BrandingTab disabled={!canEdit} /></TabsContent>
          {!purchase && <TabsContent value="banking"><BankingTab disabled={!canEdit} /></TabsContent>}
          <TabsContent value="notes"><NotesTab disabled={!canEdit} /></TabsContent>
          <TabsContent value="terms"><TermsTab disabled={!canEdit} /></TabsContent>
          <TabsContent value="signature"><SignatureTab disabled={!canEdit} /></TabsContent>
        </div>
      </Tabs>

      <PreviewModal open={previewOpen} onOpenChange={setPreviewOpen} settings={settings} />
    </div>
  );
}
