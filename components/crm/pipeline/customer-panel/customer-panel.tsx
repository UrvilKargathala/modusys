"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelHeader } from "@/components/crm/pipeline/customer-panel/panel-header";
import { DetailsMediaSection } from "@/components/crm/pipeline/customer-panel/details-media-section";
import { ActivityFeed } from "@/components/crm/pipeline/customer-panel/activity-feed";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";
import { useOpenCustomerId, usePanelShowActivity, customerPanelStore } from "@/lib/store/customer-panel-store";
import { useCustomers, customersStore } from "@/lib/store/customers-store";
import { profileOverridesStore, useProfileOverride } from "@/lib/store/customer-profile-overrides-store";
import { getCustomerProfile } from "@/lib/mock/customer-detail";
import { useEffectivePipelineStages } from "@/lib/store/custom-pipeline-stages-store";
import { getCurrentUser, CURRENT_USER_ID } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function CustomerPanel() {
  const customerId = useOpenCustomerId();
  const showActivity = usePanelShowActivity();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  // Delete icon shows for everyone — the actual delete is gated inside
  // openDelete(). Non-super-admin taps get a toast telling them they
  // can't delete.
  const canDelete = true;
  const deleteAllowed = currentUser.role === "super-admin";

  // Brief simulated fetch so the skeleton state is real, not just designed —
  // real data is synchronous mock today but this is where a real API call
  // would go (Phase B2).
  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    // Details-only view (opened from the Customers table) has nothing else
    // to show, so open it expanded by default instead of requiring a click.
    setDetailsExpanded(!showActivity);
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customers = useCustomers();
  const effectiveStages = useEffectivePipelineStages();
  const customer = customerId ? customers.find((c) => c.id === customerId) : undefined;
  const stage = customer ? effectiveStages.find((s) => s.key === customer.stage) : undefined;
  const override = useProfileOverride(customerId ?? "");
  const profile = customer ? getCustomerProfile(customer) : undefined;

  const handleDelete = () => {
    if (!customer) return;
    const deleted = customer;
    customersStore.deleteCustomer(deleted.id);
    setDeleteOpen(false);
    customerPanelStore.close();
    toastStore.show(`${deleted.name} deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => customersStore.restoreCustomer(deleted.id) },
    });
  };

  return (
    <>
      <Sheet open={customerId !== null} onOpenChange={(open) => !open && customerPanelStore.close()}>
        <SheetContent
          side="right"
          // The base Sheet styles the [data-side=right] width at higher CSS
          // specificity than a plain `w-full` override, so it has to be
          // matched at the same [data-side=right] selector shape to actually
          // win — full-screen on mobile, fixed max-width from sm: up.
          className="flex flex-col gap-0 p-0 data-[side=right]:w-screen sm:data-[side=right]:w-full sm:data-[side=right]:max-w-[460px]"
          showCloseButton={false}
        >
          {loading || !customer || !stage ? (
            <PanelSkeleton />
          ) : (
            <>
              <PanelHeader
                customer={customer}
                stage={stage}
                onNameClick={() => setDetailsExpanded((e) => !e)}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => setEditOpen(true)}
                onDelete={() => {
                  if (!deleteAllowed) {
                    toastStore.show("Only Super Admin can delete customers", "error");
                    return;
                  }
                  setDeleteOpen(true);
                }}
              />
              <DetailsMediaSection
                customer={customer}
                expanded={detailsExpanded}
                onCollapse={() => setDetailsExpanded(false)}
                fill={!showActivity}
              />
              {showActivity && <ActivityFeed customerId={customer.id} />}
            </>
          )}
        </SheetContent>
      </Sheet>

      {customer && profile && (
        <CustomerFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          customer={customer}
          profile={profile}
          override={override}
          onSubmit={(values) => {
            customersStore.updateCustomer(customer.id, {
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
            });
            // architectId has no Customer column yet — stays client-only.
            profileOverridesStore.setFields(customer.id, {
              architectId: values.architectId,
              updatedAt: new Date().toISOString(),
              updatedById: CURRENT_USER_ID,
            });
          }}
        />
      )}

      <DeleteCustomerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customer={customer ?? null}
        onConfirm={handleDelete}
      />
    </>
  );
}
