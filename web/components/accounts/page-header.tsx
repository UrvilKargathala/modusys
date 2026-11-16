// Title + one line of help on the left, buttons on the right. Same look as the Payroll pages.
export function PageHeader({ title, help, children }: { title: string; help: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">{title}</h1>
        <p className="text-sm font-body text-grey-500">{help}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 print:hidden">{children}</div>}
    </div>
  );
}

export const FILTER_FORM = "flex flex-wrap items-end gap-3 rounded-xl border border-grey-100 bg-card p-3 print:hidden";
export const FILTER_LABEL = "flex flex-col gap-1 text-xs text-grey-500";
export const FILTER_SELECT = "h-9 min-w-40 rounded-md border border-grey-200 bg-card px-2 text-sm text-grey-900";
export const APPLY_BUTTON = "h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90";
