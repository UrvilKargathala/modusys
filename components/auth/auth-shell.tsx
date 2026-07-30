import { AuthToggle } from "@/components/auth/auth-toggle";
import { AuthShowcasePanel } from "@/components/auth/auth-showcase-panel";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <div className="flex w-full flex-col items-center justify-center bg-light px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-1 text-center">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-white">
              M
            </div>
            <span className="font-heading text-2xl font-semibold text-grey-900">Modusys</span>
            <span className="text-sm font-body text-grey-400">Modular Business Platform</span>
          </div>

          <AuthToggle />

          <div className="mt-6">{children}</div>
        </div>
      </div>

      <AuthShowcasePanel />
    </div>
  );
}
