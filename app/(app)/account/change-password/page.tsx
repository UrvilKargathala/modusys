"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/auth/icon-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { withPasswordFields } from "@/lib/password-schema";
import { setSessionUser } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";

const changePasswordSchema = withPasswordFields({
  currentPassword: z.string().min(1, "Current password is required"),
});
type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onChange",
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordValues) => {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.password }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        setError("currentPassword", { message: "Current password is incorrect" });
      } else {
        const body = await res.json().catch(() => null);
        toastStore.show(body?.error ?? "Failed to change password", "error");
      }
      return;
    }

    const { user } = await res.json();
    setSessionUser(user);
    toastStore.show("Password updated");
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold text-grey-900">Change Password</h1>
        <p className="text-sm font-body text-grey-400">
          You must set a new password before continuing.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <IconInput
          icon={Lock}
          label="Current Password"
          type="password"
          placeholder="••••••••"
          error={errors.currentPassword?.message}
          disabled={isSubmitting}
          {...register("currentPassword")}
        />

        <div className="flex flex-col gap-1.5">
          <IconInput
            icon={Lock}
            label="New Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            disabled={isSubmitting}
            {...register("password")}
          />
          <PasswordRequirements value={watch("password")} />
        </div>

        <IconInput
          icon={Lock}
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          disabled={isSubmitting}
          {...register("confirmPassword")}
        />

        <Button type="submit" size="lg" disabled={isSubmitting || !isValid} className="mt-1 w-full font-body font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save and Continue"
          )}
        </Button>
      </form>
    </div>
  );
}
