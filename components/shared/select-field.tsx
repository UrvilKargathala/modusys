"use client";

import { Children, Fragment, isValidElement, useState, type ReactNode } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string; disabled?: boolean };
export type SelectChange = { target: { value: string; name: string }; currentTarget: { value: string; name: string } };

const text = (n: ReactNode): string =>
  Children.toArray(n)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? text((c.props as { children?: ReactNode }).children) : ""))
    .join("");

// Reads <option> children (also inside fragments and .map arrays), so a native <SelectField> can be swapped in place.
function options(children: ReactNode): Opt[] {
  return Children.toArray(children).flatMap((c): Opt[] => {
    if (!isValidElement(c)) return [];
    const p = c.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
    if (c.type === Fragment) return options(p.children);
    const label = text(p.children);
    return [{ value: p.value !== undefined ? String(p.value) : label, label, disabled: p.disabled }];
  });
}

// The app's one dropdown: a button that opens a list in a popover, with a search box once the list is long.
// Drop-in for <SelectField>: same value / onChange (e.target.value) / <option> children / className.
export function SelectField({
  value,
  defaultValue,
  name,
  onBlur,
  ref,
  onChange,
  children,
  className,
  disabled,
  id,
  title,
  onAdd,
  addLabel,
  onAddClick,
  searchPlaceholder,
  "aria-label": ariaLabel,
}: {
  value?: string | number;
  defaultValue?: string | number;
  // For form libraries and FormData: the chosen value is mirrored into a hidden input with this name / ref.
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBlur?: (e: any) => unknown;
  ref?: React.Ref<HTMLInputElement>;
  onChange?: (e: SelectChange) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  title?: string;
  // When given, the list ends with an "Add new" box: type a name and onAdd runs with it.
  onAdd?: (name: string) => void;
  // Text of the add row ("Add new purchase order type") and of the search box.
  addLabel?: string;
  // Instead of the inline name box, the add row just calls this (for example to open the full Add form).
  onAddClick?: () => void;
  searchPlaceholder?: string;
  "aria-label"?: string;
}) {
  const [adding, setAdding] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const opts = options(children);
  const current = String(value ?? inner);
  const shown = opts.find((o) => o.value === current) ?? opts[0];
  const searchable = opts.length > 7 || !!onAdd || !!onAddClick;
  const results = searchable ? opts.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : opts;

  return (
    <>
      {name !== undefined && <input type="hidden" ref={ref} name={name} value={current} readOnly />}
    <Popover open={open && !disabled} onOpenChange={(n) => { setOpen(disabled ? false : n); if (!n) { setQuery(""); setAddMode(false); } }}>
      <PopoverTrigger
        id={id}
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn("flex min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60", className)}
      >
        <span className={cn("min-w-0 truncate", !current && "text-grey-400")}>{shown?.label ?? ""}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {searchable && <Input autoFocus placeholder={searchPlaceholder ?? "Search"} value={query} onChange={(e) => setQuery(e.target.value)} className="mb-1" />}
        <div className="flex max-h-60 flex-col overflow-y-auto">
          {results.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => {
                setOpen(false);
                setQuery("");
                if (o.value !== current) {
                  setInner(o.value);
                  const ev = { target: { value: o.value, name: name ?? "" }, currentTarget: { value: o.value, name: name ?? "" } };
                  onChange?.(ev);
                  onBlur?.(ev);
                }
              }}
              className={cn(
                "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600 disabled:cursor-not-allowed disabled:text-grey-300",
                o.value === current ? "text-primary" : "text-grey-800"
              )}
            >
              <span className="min-w-0 truncate">{o.label}</span>
              {o.value === current && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
        </div>
        {(onAdd || onAddClick) && (
          <div className="mt-1 border-t border-grey-100 pt-1.5">
            {addMode && onAdd ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = adding.trim();
                  if (!name) return;
                  setAdding("");
                  setAddMode(false);
                  setOpen(false);
                  onAdd?.(name);
                }}
              >
                <input
                  autoFocus
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                  placeholder="Name"
                  aria-label={addLabel ?? "Add new"}
                  className="h-8 min-w-0 flex-1 rounded-md border border-grey-100 bg-card px-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
                />
                <button type="submit" className="h-8 rounded-md bg-primary px-2.5 text-sm font-body font-medium text-white">Add</button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onAddClick) {
                    setOpen(false);
                    onAddClick();
                    return;
                  }
                  setAddMode(true);
                  setAdding(query.trim());
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body text-primary hover:bg-light-600"
              >
                <Plus className="h-4 w-4" />
                {addLabel ?? "Add new"}
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
    </>
  );
}
