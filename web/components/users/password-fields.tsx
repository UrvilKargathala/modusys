"use client";

import { useState } from "react";
import type { UseFormRegister, UseFormSetValue, FieldValues, Path } from "react-hook-form";
import { Wand2, Copy, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { generateSecurePassword } from "@/lib/generate-password";

// Shared Password + Confirm Password pair (generate/copy/live strength
// checklist) reused by Invite New User and Set Password — same fields,
// generic over any form whose values include `password`/`confirmPassword`.
export function PasswordFields<T extends FieldValues & { password: string; confirmPassword: string }>({
  register,
  setValue,
  passwordValue,
  errors,
}: {
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  passwordValue: string;
  errors: { password?: { message?: string }; confirmPassword?: { message?: string } };
}) {
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const next = generateSecurePassword();
    setValue("password" as Path<T>, next as never, { shouldValidate: true });
    setValue("confirmPassword" as Path<T>, next as never, { shouldValidate: true });
  };

  const copy = async () => {
    if (!passwordValue) return;
    await navigator.clipboard.writeText(passwordValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="pw-password">Password</Label>
          <Button type="button" variant="outline" size="sm" onClick={generate}>
            <Wand2 className="h-3.5 w-3.5" />
            Generate secure password
          </Button>
        </div>
        <div className="relative">
          <Input
            id="pw-password"
            type="text"
            placeholder="Enter or generate a password"
            className="pr-9"
            {...register("password" as Path<T>)}
          />
          <button
            type="button"
            onClick={copy}
            aria-label="Copy password"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-grey-400 hover:bg-light-600 hover:text-primary"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <span className="text-xs font-body text-error">{errors.password.message}</span>}
        <PasswordRequirements value={passwordValue} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-confirm">Confirm Password</Label>
        <Input id="pw-confirm" type="text" placeholder="Re-enter the password" {...register("confirmPassword" as Path<T>)} />
        {errors.confirmPassword && (
          <span className="text-xs font-body text-error">{errors.confirmPassword.message}</span>
        )}
      </div>
    </>
  );
}
