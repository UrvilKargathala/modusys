"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  label: string;
  error?: string;
  helperText?: string;
};

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon: Icon, label, error, helperText, id, className, type, ...props }, ref) => {
    const inputId = id ?? props.name;
    // Password boxes get a show/hide eye so the user can check what they typed.
    const isPassword = type === "password";
    const [visible, setVisible] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-body font-medium text-grey-700">
          {label}
        </label>
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            id={inputId}
            ref={ref}
            type={isPassword && visible ? "text" : type}
            className={cn(
              "w-full rounded-lg border bg-card py-2.5 pl-10 text-sm font-body text-grey-900 outline-none transition-colors placeholder:text-grey-300",
              "focus:ring-2 focus:ring-offset-0",
              error
                ? "border-error focus:border-error focus:ring-error-100"
                : "border-grey-100 focus:border-primary focus:ring-primary-100",
              isPassword ? "pr-10" : "pr-3",
              props.disabled && "cursor-not-allowed bg-light-600 text-grey-400",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((v) => !v)}
              disabled={props.disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-grey-400 hover:text-grey-700 disabled:cursor-not-allowed"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error ? (
          <span className="text-xs font-body text-error">{error}</span>
        ) : helperText ? (
          <span className="text-xs font-body text-grey-400">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

IconInput.displayName = "IconInput";
