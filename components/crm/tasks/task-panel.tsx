"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Check } from "lucide-react";
import { useOpenTaskId, taskPanelStore } from "@/lib/store/task-panel-store";
import { useTasks, tasksStore } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { useCustomers } from "@/lib/store/customers-store";
import { getPriority } from "@/lib/constants/priority";
import { cn } from "@/lib/utils";

function formatDueDate(iso: string) {
  if (!iso) return "not set";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Global panel (mounted once in AppShell) so a notification click can open a
// task's detail from any page — same reasoning as the Customer Detail Sidebar.
export function TaskPanel() {
  const taskId = useOpenTaskId();
  const tasks = useTasks();
  const users = useOrgUsers();
  const customers = useCustomers();
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;

  return (
    <Sheet open={taskId !== null} onOpenChange={(open) => !open && taskPanelStore.close()}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-screen sm:data-[side=right]:w-full sm:data-[side=right]:max-w-[420px]"
        showCloseButton
      >
        {task && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-grey-900">{task.title}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
                  getPriority(task.priority).light,
                  getPriority(task.priority).solid
                )}
              >
                {getPriority(task.priority).label}
              </span>
            </div>

            {task.description && (
              <p className="text-sm font-body text-grey-600">{task.description}</p>
            )}

            <div className="flex flex-col gap-2 rounded-lg bg-light-600 p-3 text-sm font-body">
              <div className="flex items-center gap-2 text-grey-600">
                <Calendar className="h-4 w-4 text-grey-400" />
                Due {formatDueDate(task.dueDate)}
              </div>
              <div className="flex items-center gap-2 text-grey-600">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-primary-transparent text-[10px] text-primary">
                    {userName(task.assigneeId)[0]}
                  </AvatarFallback>
                </Avatar>
                Assigned to {userName(task.assigneeId)}
                {task.createdById !== task.assigneeId && <> by {userName(task.createdById)}</>}
              </div>
              {task.customerId && (
                <div className="flex items-center gap-2 text-grey-600">
                  <Users className="h-4 w-4 text-grey-400" />
                  {customers.find((c) => c.id === task.customerId)?.name ?? "Unknown customer"}
                </div>
              )}
            </div>

            <Button
              variant={task.completed ? "outline" : "default"}
              onClick={() => tasksStore.toggleComplete(task.id)}
            >
              <Check className="h-4 w-4" />
              {task.completed ? "Mark as pending" : "Mark Complete"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
