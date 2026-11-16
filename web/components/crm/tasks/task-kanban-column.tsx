"use client";

import { useDroppable } from "@dnd-kit/core";
import { ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskCard } from "@/components/crm/tasks/task-card";
import type { Task } from "@/lib/store/tasks-store";

export type TaskColumnKey = "pending" | "completed";

export function TaskKanbanColumn({
  columnKey,
  label,
  dotClassName,
  tasks,
}: {
  columnKey: TaskColumnKey;
  label: string;
  dotClassName: string;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <div className="flex w-80 shrink-0 flex-col gap-3 rounded-lg border border-grey-100 bg-light-600 p-3 max-h-[calc(100vh-260px)]">
      <div className="-mx-3 -mt-3 flex shrink-0 items-center justify-between gap-2 bg-light-600 px-3 pt-3 pb-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-body font-semibold text-grey-800">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClassName)} />
          {label}
        </span>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-number font-medium text-grey-500">{tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto scrollbar-hide rounded-md p-1 transition-colors",
          isOver && "bg-primary-transparent ring-2 ring-primary/40"
        )}
      >
        {tasks.length === 0 ? (
          <EmptyState icon={ListTodo} message={`No ${label.toLowerCase()} tasks.`} />
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
