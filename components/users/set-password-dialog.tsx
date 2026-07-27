"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordFields } from "@/components/users/password-fields";
import { withPasswordFields } from "@/lib/password-schema";
import { usersStore } from "@/lib/store/users-store";
import { securityAuditStore } from "@/lib/store/security-audit-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import type { OrgUser } from "@/lib/mock/users";

const setPasswordSchema = withPasswordFields({ requireChange: z.boolean() });
type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export function SetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: OrgUser | null;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "", requireChange: false },
  });

  if (!user) return null;

  const onSubmit = async (values: SetPasswordValues) => {
    try {
      await usersStore.setPassword(user.id, values.password, values.requireChange);
      securityAuditStore.logEvent(`${getCurrentUser().name} set a new password for ${user.name}`);
      toastStore.show(`Password updated for ${user.name}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toastStore.show(err instanceof Error ? err.message : "Failed to set password", "error");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set New Password for {user.name}</DialogTitle>
          <DialogDescription>
            This directly overrides their current password — no confirmation from them is required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <PasswordFields register={register} setValue={setValue} passwordValue={watch("password")} errors={errors} />

          <label className="flex items-center gap-2 text-sm font-body text-grey-700">
            <input type="checkbox" className="h-3.5 w-3.5 accent-primary" {...register("requireChange")} />
            Require password change on next login
          </label>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !isValid} className="w-full">
              Save Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
