"use client";

import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { askStore, useAskRequest, type AskRequest } from "@/lib/store/ask-store";
import { cn } from "@/lib/utils";

const cancel = (req: AskRequest) => askStore.answer(req.kind === "text" ? null : false);

// Shows whatever ask.confirm() / ask.text() is waiting on. Mounted once in the root layout, next to the toasts.
export function AskDialogHost() {
  const req = useAskRequest();
  return (
    <AlertDialog open={!!req} onOpenChange={(o) => { if (!o && req) cancel(req); }}>
      {/* key: each question starts with its own default text. */}
      {req && <AskBody key={req.id} req={req} />}
    </AlertDialog>
  );
}

function AskBody({ req }: { req: AskRequest }) {
  const [value, setValue] = useState(req.kind === "text" ? (req.defaultValue ?? "") : "");
  const isText = req.kind === "text";
  const blocked = isText && !!req.required && !value.trim();

  return (
    <AlertDialogContent>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) askStore.answer(isText ? value.trim() : true);
        }}
        className="flex flex-col gap-4"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{req.title}</AlertDialogTitle>
          {req.description && <AlertDialogDescription className="whitespace-pre-line">{req.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {req.kind === "text" && (
          <div className="flex flex-col gap-1.5">
            {req.label && <Label htmlFor="ask-input">{req.label}</Label>}
            {req.multiline ? (
              <textarea id="ask-input" autoFocus rows={3} value={value} maxLength={req.maxLength} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)}
                className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            ) : (
              <Input id="ask-input" autoFocus value={value} maxLength={req.maxLength} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
            )}
          </div>
        )}
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={() => cancel(req)}>{req.cancelLabel ?? "Cancel"}</Button>
          <Button type="submit" disabled={blocked} className={cn(req.tone === "danger" && "bg-error text-white hover:bg-error/90")}>{req.confirmLabel ?? "OK"}</Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  );
}
