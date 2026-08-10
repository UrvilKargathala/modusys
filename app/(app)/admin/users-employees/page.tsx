import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/require-user";
import { UsersEmployeesLinker } from "@/components/admin/users-employees-linker";

export const dynamic = "force-dynamic";

export default async function UsersEmployeesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super-admin") redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Users ↔ Employees</h1>
        <p className="text-sm font-body text-grey-500">
          Link each user account to the employee record that owns their attendance and leaves.
          Suggested matches use exact email or exact name.
        </p>
      </div>
      <UsersEmployeesLinker />
    </div>
  );
}
