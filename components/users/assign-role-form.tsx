"use client";

import { SelectField } from "@/components/shared/select-field";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleSelectField } from "@/components/users/role-select-field";
import { usersStore, useOrgUsers } from "@/lib/store/users-store";
import { roleKeys } from "@/lib/constants/roles";

const assignSchema = z.object({
  userId: z.string().min(1, "Select a user"),
  role: z.enum(roleKeys, { message: "Select a role" }),
});

type AssignValues = z.infer<typeof assignSchema>;

export function AssignRoleForm({ onDone }: { onDone: () => void }) {
  const users = useOrgUsers();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssignValues>({ resolver: zodResolver(assignSchema) });

  const role = watch("role");

  const onSubmit = async (values: AssignValues) => {
    usersStore.assignRole(values.userId, values.role);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-user">User</Label>
        <SelectField
          id="assign-user"
          {...register("userId")}
          defaultValue=""
          className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
        >
          <option value="" disabled>
            Select user
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email}
            </option>
          ))}
        </SelectField>
        {errors.userId && <span className="text-xs font-body text-error">{errors.userId.message}</span>}
      </div>

      <RoleSelectField
        id="assign-role"
        value={role ?? ""}
        registerProps={register("role")}
        error={errors.role?.message}
      />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        Update Role
      </Button>
    </form>
  );
}
