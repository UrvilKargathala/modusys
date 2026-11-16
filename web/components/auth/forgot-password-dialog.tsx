"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Super Admin-mediated reset is the permanent design for this app (business
// confirmed) — no real reset-email infra, so this just points the user at
// their admin instead of pretending to send anything.
export function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSent(false);
          setEmail("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            {sent ? "" : "Enter your account email to continue."}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex items-start gap-2 rounded-lg bg-info-transparent px-3 py-3 text-sm font-body text-info">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Contact your admin to reset your password. Passwords in this app are set by your organization's Super Admin.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={() => setSent(true)} disabled={!email} className="w-full">
              Send reset instructions
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
