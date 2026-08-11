import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/require-user";
import { PhotoAttendanceWidget } from "@/components/attendance/photo-attendance-widget";

export const dynamic = "force-dynamic";

export default async function PhotoAttendancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Photo Attendance</h1>
        <p className="text-sm font-body text-grey-500">
          Check in and out with a selfie for face verification.
        </p>
      </div>
      <PhotoAttendanceWidget />
    </div>
  );
}
