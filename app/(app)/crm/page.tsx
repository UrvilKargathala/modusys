"use client";

import { Suspense, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PipelineTab } from "@/components/crm/pipeline/pipeline-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";

const tabLabels: Record<string, string> = {
  tickets: "Tickets",
  tasks: "Tasks",
};

function CrmPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "tickets";

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Make the default tab explicit in the URL so a fresh/shared link is
  // always unambiguous rather than relying on the ?? "tickets" fallback.
  useEffect(() => {
    if (!searchParams.get("tab")) setTab("tickets");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-grey-900">
            CRM · {tabLabels[tab] ?? "Tickets"}
          </h1>
          <p className="text-sm font-body text-grey-400">
            Manage your customer pipeline and track performance
          </p>
        </div>
        {/* Notification bell already lives in the Topbar — not rebuilt here. */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList>
          <TabsTrigger value="tickets" className="w-[100px] h-[25px]">Tickets</TabsTrigger>
          <TabsTrigger value="tasks" className="w-[100px] h-[25px]">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="pt-6">
          <PipelineTab />
        </TabsContent>

        <TabsContent value="tasks" className="pt-6">
          <TasksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={null}>
      <CrmPageContent />
    </Suspense>
  );
}
