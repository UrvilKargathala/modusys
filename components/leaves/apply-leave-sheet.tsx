"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { LeaveApplyForm } from "@/components/leaves/leave-apply-form";

export function ApplyLeaveSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonVariants()}>
        <Plus className="h-4 w-4" />
        Apply for Leave
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Apply for Leave</SheetTitle>
            <SheetDescription>
              Weekends do not count toward the total. Submissions go to admin for approval.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <LeaveApplyForm onDone={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
