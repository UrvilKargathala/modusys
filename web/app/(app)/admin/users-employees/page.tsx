import { redirect } from "next/navigation";
import { getSessionUser } from "@backend/server/require-user";
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
          Link each login to the employee record that holds their attendance, leaves and salary.
        </p>
      </div>
      <UsersEmployeesLinker />
    </div>
  );
}
