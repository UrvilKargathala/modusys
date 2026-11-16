"use client";

import { RepeatableTextList } from "@/components/templates/quote-template/repeatable-text-list";
import { useTemplateStore, useTemplateSettings } from "@/components/templates/quote-template/template-store-context";

export function NotesTab({ disabled }: { disabled: boolean }) {
  const store = useTemplateStore();
  const settings = useTemplateSettings();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-body font-medium text-grey-700">Quote Notes</span>
        <span className="text-xs font-body text-grey-400">
          Renders as a numbered "NOTE:" block on the Quote PDF, in this order.
        </span>
      </div>
      <RepeatableTextList
        items={settings.notes}
        disabled={disabled}
        addLabel="Add Note"
        emptyLabel="No notes added yet."
        onAdd={(text) => store.addNote(text)}
        onUpdate={(id, text) => store.updateNote(id, text)}
        onRemove={(id) => store.removeNote(id)}
        onMove={(index, direction) => store.moveNote(index, direction)}
      />
    </div>
  );
}
