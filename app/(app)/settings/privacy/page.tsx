import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/require-user";
import { PhotoPrivacyManager } from "@/components/settings/photo-privacy-manager";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Privacy</h1>
        <p className="text-sm font-body text-grey-500">
          Manage the selfies stored for your photo attendance check-ins and check-outs.
        </p>
      </div>
      <PhotoPrivacyManager />
    </div>
  );
}
