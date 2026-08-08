import { TopNavbar } from "@/components/layout/top-navbar";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ToastViewport } from "@/components/shared/toast-viewport";
import { TaskPanel } from "@/components/crm/tasks/task-panel";
import { AssignmentGreeter } from "@/components/crm/tasks/assignment-greeter";
import { CustomerPanel } from "@/components/crm/pipeline/customer-panel/customer-panel";
import { ArchitectPanel } from "@/components/architects/architect-panel";
import { AuthGuard } from "@/components/layout/auth-guard";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full flex-col bg-background">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">{children}</main>
        <Footer />
        <MobileBottomNav />
        <ToastViewport />
        <TaskPanel />
        <CustomerPanel />
        <ArchitectPanel />
        <AssignmentGreeter />
      </div>
    </AuthGuard>
  );
}
