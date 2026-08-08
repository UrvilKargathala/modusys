"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/session";
import { useTasks } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";

const SESSION_KEY = "modusys-task-assign-shown";

// Short square-wave beep via WebAudio — no dep, no audio file to ship.
// Volume kept low (0.05) so it's a nudge, not an ambush.
function playChime() {
  try {
    const AudioCtx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.frequency.value = 660;
    }, 120);
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 260);
  } catch {
    // silent — a missing/blocked audio ctx must not break the popup itself
  }
}

export function AssignmentGreeter() {
  const currentUser = useCurrentUser();
  const tasks = useTasks();
  const users = useOrgUsers();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ id: string; title: string; by: string }[]>([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const role = currentUser.role;
    if (role !== "staff" && role !== "admin" && role !== "no-role") return;
    if (typeof window === "undefined") return;
    // Once per browser session — don't nag on every navigation.
    if (sessionStorage.getItem(SESSION_KEY) === currentUser.id) return;

    const superAdminIds = new Set(users.filter((u) => u.role === "super-admin").map((u) => u.id));
    const mine = tasks.filter(
      (t) =>
        t.assigneeId === currentUser.id &&
        !t.completed &&
        superAdminIds.has(t.createdById) &&
        t.createdById !== currentUser.id
    );
    if (mine.length === 0) return;

    setPending(
      mine.map((t) => ({
        id: t.id,
        title: t.title,
        by: users.find((u) => u.id === t.createdById)?.name ?? "Admin",
      }))
    );
    setOpen(true);
    playChime();
    sessionStorage.setItem(SESSION_KEY, currentUser.id);
  }, [currentUser?.id, currentUser?.role, tasks, users]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task{pending.length > 1 ? "s" : ""} for you</DialogTitle>
          <DialogDescription>
            {pending.length === 1
              ? "You have one open task assigned by admin."
              : `You have ${pending.length} open tasks assigned by admin.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {pending.slice(0, 5).map((p) => (
            <li key={p.id} className="rounded-md border border-grey-100 bg-light-600 px-3 py-2">
              <p className="text-sm font-body font-medium text-grey-900">{p.title}</p>
              <p className="text-xs font-body text-grey-500">Assigned by {p.by}</p>
            </li>
          ))}
          {pending.length > 5 && (
            <li className="text-xs font-body text-grey-500">
              …and {pending.length - 5} more.
            </li>
          )}
        </ul>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
          <Link
            href="/crm"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            Open Tasks
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
