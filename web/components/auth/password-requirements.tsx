import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const requirements = [
  { label: "Minimum 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /[0-9]/.test(v) },
  { label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordMeetsAllRequirements(value: string) {
  return requirements.every((r) => r.test(value));
}

export function PasswordRequirements({ value }: { value: string }) {
  return (
    <ul className="flex flex-col gap-1 pt-1">
      {requirements.map((req) => {
        const met = req.test(value);
        return (
          <li key={req.label} className="flex items-center gap-1.5 text-xs font-body">
            <span
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors",
                met ? "border-success bg-success text-white" : "border-grey-200 bg-transparent"
              )}
            >
              {met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className={cn(met ? "text-success" : "text-grey-400")}>{req.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
