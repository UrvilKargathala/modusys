"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InviteForm } from "@/components/users/invite-form";

// One form: name, email, role, password. Roles are changed in the table itself.
export function AccessModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create a login for a teammate. They can sign in straight away with this password.</DialogDescription>
        </DialogHeader>
        {open && <InviteForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
