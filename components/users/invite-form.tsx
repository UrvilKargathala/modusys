"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoleSelectField } from "@/components/users/role-select-field";
import { PasswordFields } from "@/components/users/password-fields";
import { withPasswordFields } from "@/lib/password-schema";
import { usersStore } from "@/lib/store/users-store";
import { getRole, roleKeys } from "@/lib/constants/roles";

const inviteSchema = withPasswordFields({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  role: z.enum(roleKeys, { message: "Select a role" }),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function InviteForm({ onDone }: { onDone: () => void }) {
  const [invited, setInvited] = useState<InviteValues | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const role = watch("role");

  const onSubmit = (values: InviteValues) => {
    usersStore.inviteUser({ name: values.name, email: values.email, role: values.role });
    setInvited(values);
  };

  if (invited) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border border-grey-100 bg-light-600/60 p-4 text-sm font-body">
          <div className="flex justify-between gap-4">
            <span className="text-grey-500">Name</span>
            <span className="font-medium text-grey-900">{invited.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-grey-500">Email</span>
            <span className="font-medium text-grey-900">{invited.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-grey-500">Role</span>
            <span className="font-medium text-grey-900">{getRole(invited.role)?.label}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-grey-500">Password</span>
            <span className="font-mono font-medium text-grey-900">{invited.password}</span>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-info-transparent px-3 py-2 text-sm font-body text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Note this password down — it won't be shown again after you close this dialog.
        </div>
        <Button onClick={onDone} className="w-full">
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-name">Name</Label>
        <Input id="invite-name" placeholder="Full name" {...register("name")} />
        {errors.name && <span className="text-xs font-body text-error">{errors.name.message}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" type="email" placeholder="you@example.com" {...register("email")} />
        {errors.email && <span className="text-xs font-body text-error">{errors.email.message}</span>}
      </div>

      <RoleSelectField
        id="invite-role"
        value={role ?? ""}
        registerProps={register("role")}
        error={errors.role?.message}
      />

      <PasswordFields register={register} setValue={setValue} passwordValue={watch("password")} errors={errors} />

      <Button type="submit" disabled={isSubmitting || !isValid} className="w-full">
        Send Invite
      </Button>
    </form>
  );
}
