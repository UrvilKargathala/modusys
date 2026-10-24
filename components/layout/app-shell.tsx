import { Sidebar } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TaskPanel } from "@/components/crm/tasks/task-panel";
import { AssignmentGreeter } from "@/components/crm/tasks/assignment-greeter";
import { CustomerPanel } from "@/components/crm/pipeline/customer-panel/customer-panel";
import { ArchitectPanel } from "@/components/architects/architect-panel";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ResizableTables } from "@/components/layout/resizable-tables";
import { PaletteApplier } from "@/components/layout/palette-applier";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="glass-app relative isolate flex h-screen w-full overflow-hidden bg-[linear-gradient(135deg,var(--page-1)_0%,var(--page-2)_55%,var(--page-3)_100%)]">
        {/* Soft colour behind the glass panels: Cyan glow top right, faint peach glow bottom left. */}
        <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-[30rem] w-[30rem] rounded-full bg-[#84CEF0]/35 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#FFD599]/22 blur-3xl" />
        <ResizableTables />
        <PaletteApplier />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavbar />
          <main className="flex-1 overflow-auto p-4 pb-20 lg:p-6 lg:pb-6">{children}</main>
        </div>
        <MobileBottomNav />
        <TaskPanel />
        <CustomerPanel />
        <ArchitectPanel />
        <AssignmentGreeter />
      </div>
    </AuthGuard>
  );
}
