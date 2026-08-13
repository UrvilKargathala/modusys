"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Check, UserRound, UserRoundPlus } from "lucide-react";
import { useOpenTaskId, taskPanelStore } from "@/lib/store/task-panel-store";
import { useTasks, tasksStore } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { useCustomers } from "@/lib/store/customers-store";
import { customerPanelStore } from "@/lib/store/customer-panel-store";
import { getPriority } from "@/lib/constants/priority";
import { cn } from "@/lib/utils";

function formatDueDate(iso: string) {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function TaskPanel() {
  const taskId = useOpenTaskId();
  const tasks = useTasks();
  const users = useOrgUsers();
  const customers = useCustomers();
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
  const customer = task?.customerId ? customers.find((c) => c.id === task.customerId) : null;
  const priority = task ? getPriority(task.priority) : null;
  const differentPeople = task ? task.createdById !== task.assigneeId : false;

  return (
    <Sheet open={taskId !== null} onOpenChange={(open) => !open && taskPanelStore.close()}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-screen sm:data-[side=right]:w-full sm:data-[side=right]:max-w-[420px]"
        showCloseButton
      >
        {task && priority && (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-semibold text-grey-900">{task.title}</h2>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
                    priority.light,
                    priority.solid
                  )}
                >
                  {priority.label}
                </span>
              </div>
              {task.description && (
                <p className="text-sm font-body text-grey-600">{task.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-body text-grey-400">Due Date</span>
                <div className="flex items-center gap-1.5 text-sm font-number text-grey-800">
                  <Calendar className="h-3.5 w-3.5 text-grey-400" />
                  {formatDueDate(task.dueDate)}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-body text-grey-400">Priority</span>
                <span className={cn("text-sm font-body font-medium", priority.solid)}>
                  {priority.label}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-body text-grey-400">Assigned To</span>
                <div className="flex items-center gap-1.5 text-sm font-body text-grey-800">
                  <UserRound className="h-3.5 w-3.5 text-grey-400" />
                  {userName(task.assigneeId)}
                </div>
              </div>

              {differentPeople && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-body text-grey-400">Created By</span>
                  <div className="flex items-center gap-1.5 text-sm font-body text-grey-800">
                    <UserRoundPlus className="h-3.5 w-3.5 text-grey-400" />
                    {userName(task.createdById)}
                  </div>
                </div>
              )}

              {customer && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-body text-grey-400">Customer</span>
                  <button
                    type="button"
                    onClick={() => {
                      taskPanelStore.close();
                      customerPanelStore.open(customer.id);
                    }}
                    className="flex items-center gap-1.5 text-sm font-body text-primary hover:underline text-left"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {customer.name}
                  </button>
                </div>
              )}
            </div>

            <Button
              variant={task.completed ? "outline" : "default"}
              className="mt-2"
              onClick={() => tasksStore.toggleComplete(task.id)}
            >
              <Check className="h-4 w-4" />
              {task.completed ? "Mark as Pending" : "Mark Complete"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
