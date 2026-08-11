"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Settings, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PipelineTab } from "@/components/crm/pipeline/pipeline-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { customersStore } from "@/lib/store/customers-store";
import { profileOverridesStore } from "@/lib/store/customer-profile-overrides-store";
import { CURRENT_USER_ID } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";

const tabLabels: Record<string, string> = {
  tickets: "Tickets",
  tasks: "Tasks",
};

function CrmPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "tickets";
  const [addOpen, setAddOpen] = useState(false);

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
          <Link href="/admin/pipeline-stages" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <Button size="sm" onClick={() => setAddOpen(true)}>
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

      <CustomerFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={async (values) => {
          const created = await customersStore.createCustomer({
            prefix: values.prefix,
            firstName: values.firstName,
            lastName: values.lastName,
            customerCode: values.customerCode,
            mobile: values.mobile,
            email: values.email,
            gst: values.gst,
            address: values.address,
            city: values.city,
            state: values.state,
            postcode: values.postcode,
            birthdayMonth: values.birthdayMonth,
            birthdayDay: values.birthdayDay,
            birthdayYear: values.birthdayYear,
            createdById: CURRENT_USER_ID,
          });
          if (created?.id && values.architectId) {
            profileOverridesStore.setFields(created.id, { architectId: values.architectId });
          }
          toastStore.show(`${values.firstName} ${values.lastName} added`, "success");
        }}
      />
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
