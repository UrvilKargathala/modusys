"use client";

import { useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usersStore } from "@/lib/store/users-store";
import { toastStore } from "@/lib/store/toast-store";
import type { OrgUser } from "@/lib/mock/users";

const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
type EditUserValues = z.infer<typeof editUserSchema>;

// Super Admin-only rename/re-email — role and password changes go through
// their own dedicated dialogs (RoleCell / SetPasswordDialog) rather than
// this one, keeping each mutation's audit trail specific to what changed.
export function EditUserDialog({
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
    reset,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (!open || !user) return;
    reset({ name: user.name, email: user.email });
  }, [open, user, reset]);

  if (!user) return null;

  const onSubmit = (values: EditUserValues) => {
    if (usersStore.isEmailTaken(values.email, user.id)) {
      setError("email", { message: "Another user already has this email." });
      return;
    }
    usersStore.updateUser(user.id, values);
    toastStore.show(`"${values.name}" updated`);
    onOpenChange(false);
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
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>Update this user's name and email.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eu-name">Name *</Label>
            <Input id="eu-name" {...register("name")} />
            {errors.name && <span className="text-xs font-body text-error">{errors.name.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eu-email">Email *</Label>
            <Input id="eu-email" type="email" {...register("email")} />
            {errors.email && <span className="text-xs font-body text-error">{errors.email.message}</span>}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
