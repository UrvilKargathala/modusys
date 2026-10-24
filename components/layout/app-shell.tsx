import { Sidebar } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TaskPanel } from "@/components/crm/tasks/task-panel";
import { AssignmentGreeter } from "@/components/crm/tasks/assignment-greeter";
import { CustomerPanel } from "@/components/crm/pipeline/customer-panel/customer-panel";
import { ArchitectPanel } from "@/components/architects/architect-panel";
import { AuthGuard } from "@/components/layout/auth-guard";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col lg:bg-grey-transparent">
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
