"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserPicker } from "@/components/crm/tasks/user-picker";
import { tasksStore } from "@/lib/store/tasks-store";
import { priorities } from "@/lib/constants/priority";
import { useCustomers } from "@/lib/store/customers-store";
import { useCurrentUser } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  dueDate: z.string(),
  assigneeId: z.string().min(1, "Assignee is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  customerId: z.string(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function TaskFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const customers = useCustomers();
  const currentUser = useCurrentUser();
  const canAssignOthers = currentUser.role === "super-admin" || currentUser.role === "admin";
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      assigneeId: currentUser.id,
      priority: "normal",
      customerId: "",
    },
  });

  const onSubmit = async (values: TaskFormValues) => {
    try {
      await tasksStore.createTask({
        title: values.title,
        description: values.description,
        dueDate: values.dueDate,
        // Staff can only self-assign — the API will reject anything else, but
        // block it in the UI too so the error path never fires.
        assigneeId: canAssignOthers ? values.assigneeId : currentUser.id,
        priority: values.priority,
        customerId: values.customerId || null,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toastStore.show(err instanceof Error ? err.message : "Failed to create task", "error");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Add a task and assign it to a team member.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" placeholder="e.g. Follow up on quote" {...register("title")} />
            {errors.title && <span className="text-xs font-body text-error">{errors.title.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description (optional)</Label>
            <textarea
              id="task-description"
              rows={3}
              placeholder="Add any extra context"
              {...register("description")}
              className="w-full resize-none rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due-date">Due Date (optional)</Label>
              <Input id="task-due-date" type="date" {...register("dueDate")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                {...register("priority")}
                className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
              >
                {priorities.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Assignee {!canAssignOthers && <span className="text-xs text-grey-400">(you)</span>}</Label>
            {canAssignOthers ? (
              <Controller
                control={control}
                name="assigneeId"
                render={({ field }) => <UserPicker value={field.value} onChange={field.onChange} />}
              />
            ) : (
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body text-grey-700">
                {currentUser.name}
              </div>
            )}
            {errors.assigneeId && (
              <span className="text-xs font-body text-error">{errors.assigneeId.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-customer">Linked Customer (optional)</Label>
            <select
              id="task-customer"
              {...register("customerId")}
              defaultValue=""
              className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">None</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className={cn("w-full")}>
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
