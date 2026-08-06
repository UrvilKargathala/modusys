"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users } from "lucide-react";

export function SyncButtons() {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function syncUsers() {
    setSyncing("users");
    setMessage(null);
    try {
      const res = await fetch("/api/unifi/sync-users", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage(`Synced ${data.total} users (${data.created} new, ${data.updated} updated)`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to sync users");
    }
    setSyncing(null);
    setTimeout(() => window.location.reload(), 1500);
  }

  async function syncLogs() {
    setSyncing("logs");
    setMessage(null);
    try {
      const res = await fetch("/api/unifi/sync-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Processed ${data.processed} events (${data.created} new, ${data.updated} updated)`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to sync logs");
    }
    setSyncing(null);
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-xs font-body text-grey-500 max-w-xs truncate">
          {message}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={syncUsers} disabled={syncing !== null}>
        <Users className="h-4 w-4 mr-1.5" />
        {syncing === "users" ? "Syncing..." : "Sync Users"}
      </Button>
      <Button size="sm" onClick={syncLogs} disabled={syncing !== null}>
        <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing === "logs" ? "animate-spin" : ""}`} />
        {syncing === "logs" ? "Syncing..." : "Sync Door Logs"}
      </Button>
    </div>
  );
}
