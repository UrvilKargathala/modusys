"use client";

import { RepeatableTextList } from "@/components/templates/quote-template/repeatable-text-list";
import { useTemplateStore, useTemplateSettings } from "@/components/templates/quote-template/template-store-context";

export function TermsTab({ disabled }: { disabled: boolean }) {
  const store = useTemplateStore();
  const settings = useTemplateSettings();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-lg border border-grey-100 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-body font-semibold text-grey-700">Terms & Conditions</span>
          <span className="text-xs font-body text-grey-400">Renders on the Quote PDF alongside Payment Terms.</span>
        </div>
        <RepeatableTextList
          items={settings.terms}
          disabled={disabled}
          addLabel="Add Term"
          emptyLabel="No terms added yet."
          onAdd={(text) => store.addTerm(text)}
          onUpdate={(id, text) => store.updateTerm(id, text)}
          onRemove={(id) => store.removeTerm(id)}
          onMove={(index, direction) => store.moveTerm(index, direction)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-grey-100 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-body font-semibold text-grey-700">Payment Terms</span>
          <span className="text-xs font-body text-grey-400">Renders on the Quote PDF's payment schedule section.</span>
        </div>
        <RepeatableTextList
          items={settings.paymentTerms}
          disabled={disabled}
          addLabel="Add Payment Term"
          emptyLabel="No payment terms added yet."
          onAdd={(text) => store.addPaymentTerm(text)}
          onUpdate={(id, text) => store.updatePaymentTerm(id, text)}
          onRemove={(id) => store.removePaymentTerm(id)}
          onMove={(index, direction) => store.movePaymentTerm(index, direction)}
        />
      </section>
    </div>
  );
}
