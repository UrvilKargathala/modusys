"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Wraps a single settings field with a label, a "renders on the client PDF"
// hint, and a save-on-blur "Saved" blip — every Layout/Branding/Banking/
// Signature field in this module follows this same autosave contract.
export function PdfField({
  label,
  htmlFor,
  helperText,
  disabled,
  children,
  savedTick,
}: {
  label: string;
  htmlFor: string;
  helperText?: string;
  disabled?: boolean;
  children: React.ReactNode;
  savedTick: number;
}) {
  const [showSaved, setShowSaved] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [savedTick]);

  return (
    <div className={cn("flex flex-col gap-1.5", disabled && "opacity-60")}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        <Tooltip>
          <TooltipTrigger className="flex items-center text-grey-300">
            <FileText className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Renders on the client-facing Quote PDF</TooltipContent>
        </Tooltip>
        <span
          className={cn(
            "text-xs font-body text-success transition-opacity",
            showSaved ? "opacity-100" : "opacity-0"
          )}
        >
          Saved
        </span>
      </div>
      {children}
      {helperText && <p className="text-xs font-body text-grey-400">{helperText}</p>}
    </div>
  );
}
