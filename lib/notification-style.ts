import { UserPlus, Clock3, CheckCircle2, AtSign, CalendarDays, CalendarX2, AlertTriangle, FileText } from "lucide-react";
import type { NotificationType } from "@/lib/store/notifications-store";
import type { VirtualNotification } from "@/lib/notifications-feed";

// Single source of truth for how each notification type looks and whether it
// needs the viewer to actually do something (vs. just FYI) — shared by the
// navbar bell dropdown and the dashboard notifications panel so they never
// drift out of sync again.
export const notificationStyle: Record<
  NotificationType,
  { icon: typeof UserPlus; iconClass: string; bgClass: string; actionNeeded: boolean }
> = {
  assigned: { icon: UserPlus, iconClass: "text-secondary", bgClass: "bg-secondary-transparent", actionNeeded: true },
  "due-soon": { icon: Clock3, iconClass: "text-orange", bgClass: "bg-orange-transparent", actionNeeded: true },
  completed: { icon: CheckCircle2, iconClass: "text-success", bgClass: "bg-success-transparent", actionNeeded: false },
  mentioned: { icon: AtSign, iconClass: "text-primary", bgClass: "bg-primary-transparent", actionNeeded: true },
  "leave-requested": {
    icon: CalendarDays,
    iconClass: "text-warning-900",
    bgClass: "bg-warning-transparent",
    actionNeeded: true,
  },
  "leave-approved": {
    icon: CalendarDays,
    iconClass: "text-success",
    bgClass: "bg-success-transparent",
    actionNeeded: false,
  },
  "leave-rejected": {
    icon: CalendarX2,
    iconClass: "text-error",
    bgClass: "bg-error-transparent",
    actionNeeded: false,
  },
};

export const virtualNotificationStyle: Record<
  VirtualNotification["kind"],
  { icon: typeof UserPlus; iconClass: string; bgClass: string; actionNeeded: boolean }
> = {
  "stale-quote": { icon: AlertTriangle, iconClass: "text-warning-900", bgClass: "bg-warning-transparent", actionNeeded: false },
  "quote-status": { icon: FileText, iconClass: "text-info", bgClass: "bg-info-transparent", actionNeeded: false },
  "new-lead": { icon: UserPlus, iconClass: "text-secondary", bgClass: "bg-secondary-transparent", actionNeeded: true },
  "task-assigned": { icon: UserPlus, iconClass: "text-secondary", bgClass: "bg-secondary-transparent", actionNeeded: true },
  "task-completed": { icon: CheckCircle2, iconClass: "text-success", bgClass: "bg-success-transparent", actionNeeded: false },
};

export function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}
