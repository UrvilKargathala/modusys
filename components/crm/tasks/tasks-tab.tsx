"use client";

import { useMemo, useState } from "react";
import { Plus, ListTodo, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskRow } from "@/components/crm/tasks/task-row";
import { TaskFormDialog } from "@/components/crm/tasks/task-form-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useTasks, visibleTasks, type TaskScope } from "@/lib/store/tasks-store";
import { useCurrentUser } from "@/lib/session";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

type StatusFilter = "pending" | "completed" | "all";

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "All", value: "all" },
];

export function TasksTab() {
  const currentUser = useCurrentUser();
  // Only super-admin gets the org-wide task view; admin and staff both
  // only see their own tasks. The API enforces this too — this flag is
  // just the UI mirror.
  const canSeeAll = currentUser.role === "super-admin";
  const scopeOptions: { label: string; value: TaskScope }[] = [
    ...(canSeeAll ? [{ label: "All Tasks", value: "all" as TaskScope }] : []),
    { label: "My Tasks", value: "mine" as TaskScope },
    { label: "Assigned by Me", value: "assigned-by-me" as TaskScope },
  ];

  const allTasks = useTasks();
  const users = useOrgUsers();
  const [scope, setScope] = useState<TaskScope>(canSeeAll ? "all" : "mine");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all"); // "all" | userId — admin-only
  const [groupByAssignee, setGroupByAssignee] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const scoped = useMemo(
    () => visibleTasks(allTasks, currentUser.id, currentUser.role === "no-role" ? "staff" : currentUser.role, scope),
    [allTasks, currentUser, scope]
  );

  const filteredTasks = useMemo(() => {
    const sorted = [...scoped].sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
    let out = sorted;
    if (status === "pending") out = out.filter((t) => !t.completed);
    else if (status === "completed") out = out.filter((t) => t.completed);
    if (canSeeAll && scope === "all" && assigneeFilter !== "all") {
      out = out.filter((t) => t.assigneeId === assigneeFilter);
    }
    return out;
  }, [scoped, status, canSeeAll, scope, assigneeFilter]);

  const grouped = useMemo(() => {
    if (!groupByAssignee) return null;
    const map = new Map<string, typeof filteredTasks>();
    for (const task of filteredTasks) {
      const list = map.get(task.assigneeId) ?? [];
      list.push(task);
      map.set(task.assigneeId, list);
    }
    return map;
  }, [filteredTasks, groupByAssignee]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-light-600 p-0.5">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-body font-medium transition-colors",
                  scope === option.value
                    ? "bg-card text-primary shadow-sm"
                    : "text-grey-400 hover:text-grey-700"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-grey-100" />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body font-medium text-grey-700 transition-colors hover:bg-light-600">
              {statusOptions.find((o) => o.value === status)?.label}
              <ChevronDown className="h-3.5 w-3.5 text-grey-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuRadioGroup
                value={status}
                onValueChange={(value) => setStatus(value as StatusFilter)}
              >
                {statusOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {canSeeAll && scope === "all" && (
            <>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                aria-label="Show tasks for"
                className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body font-medium text-grey-700 outline-none focus:border-primary"
              >
                <option value="all">Show tasks for: Everyone</option>
                <option value={currentUser.id}>Me ({currentUser.name})</option>
                {users
                  .filter((u) => u.id !== currentUser.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>

              <label className="flex items-center gap-2 text-sm font-body text-grey-500">
                <input
                  type="checkbox"
                  checked={groupByAssignee}
                  onChange={(e) => setGroupByAssignee(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                Group by assignee
              </label>
            </>
          )}
        </div>

        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          message={
            status === "completed"
              ? "No completed tasks yet."
              : "No tasks here. Create one to get started."
          }
          cta={{ label: "Create Task", onClick: () => setFormOpen(true) }}
        />
      ) : grouped ? (
        <div className="flex flex-col gap-4">
          {[...grouped.entries()].map(([assigneeId, tasks]) => (
            <div key={assigneeId} className="flex flex-col gap-2">
              <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-400">
                {users.find((u) => u.id === assigneeId)?.name ?? "Unknown"} · {tasks.length}
              </span>
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
