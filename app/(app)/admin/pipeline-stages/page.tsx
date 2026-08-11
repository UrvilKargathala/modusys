import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/require-user";
import { PipelineStagesEditor } from "@/components/admin/pipeline-stages-editor";

export const dynamic = "force-dynamic";

export default async function PipelineStagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super-admin") redirect("/crm");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Pipeline Stages</h1>
        <p className="text-sm font-body text-grey-500">
          Add custom stages to the CRM Kanban and the customer stage picker. The built-in stages
          (Upcoming Inquiry, Design, Quotation, …) stay in code and can’t be edited here yet.
        </p>
      </div>
      <PipelineStagesEditor />
    </div>
  );
}
