"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/crm/tasks/task-form-dialog";
import { TaskKanbanColumn, type TaskColumnKey } from "@/components/crm/tasks/task-kanban-column";
import { TaskCard } from "@/components/crm/tasks/task-card";
import { useTasks, visibleTasks, tasksStore, type Task, type TaskScope } from "@/lib/store/tasks-store";
import { useCurrentUser } from "@/lib/session";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

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
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all"); // "all" | userId — admin-only
  const [formOpen, setFormOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
    if (canSeeAll && scope === "all" && assigneeFilter !== "all") {
      return sorted.filter((t) => t.assigneeId === assigneeFilter);
    }
    return sorted;
  }, [scoped, canSeeAll, scope, assigneeFilter]);

  const pending = filteredTasks.filter((t) => !t.completed);
  const completed = filteredTasks.filter((t) => t.completed);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(filteredTasks.find((t) => t.id === String(event.active.id)) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const task = filteredTasks.find((t) => t.id === String(active.id));
    if (!task) return;
    const nextColumn = String(over.id) as TaskColumnKey;
    const shouldBeCompleted = nextColumn === "completed";
    if (task.completed !== shouldBeCompleted) tasksStore.toggleComplete(task.id);
  };

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

          {canSeeAll && scope === "all" && (
            <>
              <div className="h-5 w-px bg-grey-100" />
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
            </>
          )}
        </div>

        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </div>

      <DndContext id="tasks-kanban" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          <TaskKanbanColumn columnKey="pending" label="Pending" dotClassName="bg-warning" tasks={pending} />
          <TaskKanbanColumn columnKey="completed" label="Completed" dotClassName="bg-success" tasks={completed} />
        </div>

        <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
