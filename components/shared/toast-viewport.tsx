"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useToasts, toastStore, type Toast } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

// One look per kind: a white card with a coloured edge, icon and heading, so a toast is easy to notice and tell apart.
const KIND: Record<Toast["variant"], { title: string; Icon: typeof Info; edge: string; icon: string; bar: string }> = {
  success: { title: "Success", Icon: CheckCircle2, edge: "border-l-success", icon: "bg-success-transparent text-success", bar: "bg-success" },
  error: { title: "Error", Icon: AlertCircle, edge: "border-l-error", icon: "bg-error-transparent text-error", bar: "bg-error" },
  warning: { title: "Warning", Icon: AlertTriangle, edge: "border-l-warning", icon: "bg-warning-transparent text-warning", bar: "bg-warning" },
  info: { title: "Info", Icon: Info, edge: "border-l-info", icon: "bg-info-transparent text-info", bar: "bg-info" },
};

export function ToastViewport() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const { title, Icon, edge, icon, bar } = KIND[toast.variant];
        return (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={cn("toast-in pointer-events-auto relative overflow-hidden rounded-xl border border-l-4 border-grey-100 bg-white shadow-xl", edge)}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", icon)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold text-grey-900">{title}</p>
                <p className="mt-0.5 break-words font-body text-sm text-grey-700">{toast.message}</p>
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      toastStore.dismiss(toast.id);
                    }}
                    className="mt-1.5 font-body text-sm font-semibold text-primary underline underline-offset-2"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button type="button" aria-label="Close" onClick={() => toastStore.dismiss(toast.id)} className="shrink-0 rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-grey-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <span className={cn("toast-bar absolute bottom-0 left-0 h-1", bar)} style={{ animationDuration: `${toast.durationMs}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
