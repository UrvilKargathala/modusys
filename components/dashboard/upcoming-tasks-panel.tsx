"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Circle, Clock, ListTodo, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { tasksStore, type Task } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

function formatDueDate(iso: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function isOverdue(iso: string) {
  if (!iso) return false;
  return iso.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

export function UpcomingTasksPanel({
  tasks,
  onAddTask,
  title = "Upcoming Tasks",
}: {
  tasks: Task[];
  onAddTask: () => void;
  title?: ReactNode;
}) {
  const users = useOrgUsers();
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  return (
    <Card className="border-grey-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            message="No upcoming tasks. Stay ahead by adding one."
            cta={{ label: "Add a task", onClick: onAddTask }}
          />
        ) : (
          <ul className="flex flex-col">
            {tasks.map((task) => {
              const overdue = !task.completed && isOverdue(task.dueDate);
              const due = formatDueDate(task.dueDate);
              return (
                <li key={task.id} className="flex items-start gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => tasksStore.toggleComplete(task.id)}
                    aria-label={`Mark "${task.title}" as complete`}
                    className="mt-0.5 shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className={cn("h-5 w-5", overdue ? "text-error" : "text-grey-300 hover:text-primary")} />
                    )}
                  </button>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span
                      className={cn(
                        "text-sm font-body leading-snug",
                        task.completed ? "text-grey-400 line-through" : "text-grey-800"
                      )}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {due && (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          overdue ? "bg-error-transparent text-error" : "bg-grey-transparent text-grey-500"
                        )}>
                          <Clock className="h-3 w-3" />
                          {due}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] font-body text-grey-400">
                        <User className="h-3 w-3" />
                        {userName(task.assigneeId)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
