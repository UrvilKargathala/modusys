import { SelectField } from "@/components/shared/select-field";
import { Label } from "@/components/ui/label";
import { RoleInfoPopover } from "@/components/users/role-info-popover";
import { roles, type RoleKey } from "@/lib/constants/roles";

export function RoleSelectField({
  id,
  value,
  registerProps,
  error,
}: {
  id: string;
  value: RoleKey | "";
  registerProps: React.ComponentProps<typeof SelectField>;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>Role</Label>
        <RoleInfoPopover roleKey={value} />
      </div>
      <SelectField
        id={id}
        {...registerProps}
        defaultValue=""
        className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
      >
        <option value="" disabled>
          Select role
        </option>
        {roles.map((role) => (
          <option key={role.key} value={role.key}>
            {role.label}
          </option>
        ))}
      </SelectField>
      {error && <span className="text-xs font-body text-error">{error}</span>}
    </div>
  );
}
