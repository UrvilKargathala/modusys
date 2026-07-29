"use client";

import { CalendarClock, ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { tasksStore, type Task } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

function formatDueDate(iso: string) {
  if (!iso) return "no date";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function UpcomingTasksPanel({
  tasks,
  onAddTask,
  title = "Upcoming Tasks",
}: {
  tasks: Task[];
  onAddTask: () => void;
  title?: string;
}) {
  const users = useOrgUsers();
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";
  return (
    <Card className="border-grey-100">
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
          <ul className="flex flex-col divide-y divide-grey-100">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => tasksStore.toggleComplete(task.id)}
                  aria-label={`Mark "${task.title}" as complete`}
                  className={cn(
                    "mt-0.5 rounded-md p-1.5 transition-colors",
                    task.completed
                      ? "bg-success-transparent text-success"
                      : "bg-primary-transparent text-primary hover:bg-primary-100"
                  )}
                >
                  <CalendarClock className="h-4 w-4" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-sm font-body text-grey-800",
                      task.completed && "text-grey-400 line-through"
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="text-xs font-body text-grey-400">
                    {task.dueDate ? `Due ${formatDueDate(task.dueDate)}` : "No due date"} · {userName(task.assigneeId)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
