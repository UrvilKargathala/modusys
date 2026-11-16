"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InviteForm } from "@/components/users/invite-form";
import { AssignRoleForm } from "@/components/users/assign-role-form";

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
          <DialogTitle>Add or manage access</DialogTitle>
          <DialogDescription>Invite a new teammate or change an existing user's role.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="invite">
          <TabsList className="w-full">
            <TabsTrigger value="invite" className="flex-1">
              Invite New User
            </TabsTrigger>
            <TabsTrigger value="assign" className="flex-1">
              Assign Role
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="pt-4">
            <InviteForm onDone={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="assign" className="pt-4">
            <AssignRoleForm onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
