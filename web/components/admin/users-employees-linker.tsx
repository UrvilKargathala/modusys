"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, Loader2, Search, Sparkles, Users } from "lucide-react";
import { SelectField } from "@/components/shared/select-field";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roles } from "@shared/constants/roles";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

type User = { id: string; name: string; email: string; role: string; status: string; employeeId: string | null };
type Employee = { id: string; name: string; email: string | null; department: string | null; employeeNumber: string | null };
type Data = { users: User[]; employees: Employee[]; suggestions: Record<string, string> };
type RowState = "linked" | "suggested" | "unlinked";
type Filter = "all" | RowState;

const NONE = "__none__";
const emptyEmployee = { name: "", email: "", phone: "", department: "", designation: "", employeeNumber: "" };

function roleLabel(key: string) {
  return roles.find((r) => r.key === key)?.label ?? "No role";
}

export function UsersEmployeesLinker() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [newFor, setNewFor] = useState<User | null>(null);
  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [addError, setAddError] = useState<string | null>(null);
  const [showUnlinkedEmployees, setShowUnlinkedEmployees] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/users-employees", { cache: "no-store" });
    setData((await r.json()) as Data);
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/users-employees", { cache: "no-store" })
      .then((r) => r.json() as Promise<Data>)
      .then((j) => alive && setData(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const employeeById = useMemo(() => new Map((data?.employees ?? []).map((e) => [e.id, e])), [data]);
  const linkedEmpIds = useMemo(
    () => new Set((data?.users ?? []).map((u) => u.employeeId).filter(Boolean) as string[]),
    [data]
  );

  const stateOf = (u: User): RowState =>
    u.employeeId ? "linked" : data?.suggestions[u.id] ? "suggested" : "unlinked";

  const counts = useMemo(() => {
    const c = { linked: 0, suggested: 0, unlinked: 0 };
    for (const u of data?.users ?? []) c[stateOf(u)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.users ?? []).filter(
      (u) =>
        (filter === "all" || stateOf(u) === filter) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, filter]);

  const employeesWithoutLogin = useMemo(
    () => (data?.employees ?? []).filter((e) => !linkedEmpIds.has(e.id)),
    [data, linkedEmpIds]
  );

  async function link(user: User, employeeId: string | null, quiet = false): Promise<boolean> {
    setBusy(user.id);
    try {
      const r = await fetch("/api/admin/users-employees/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, employeeId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toastStore.show(j.error || "Couldn't save the link", "error");
        return false;
      }
      if (!quiet) {
        const emp = employeeId ? employeeById.get(employeeId) : null;
        toastStore.show(emp ? `${user.name} linked to ${emp.name}` : `${user.name} unlinked`);
      }
      return true;
    } finally {
      setBusy(null);
      if (!quiet) await load();
    }
  }

  async function confirmAll() {
    if (!data) return;
    const todo = data.users.filter((u) => !u.employeeId && data.suggestions[u.id]);
    setBusy("__all__");
    let ok = 0;
    for (const u of todo) if (await link(u, data.suggestions[u.id], true)) ok++;
    setBusy(null);
    await load();
    toastStore.show(`${ok} of ${todo.length} suggestions linked`, ok === todo.length ? "success" : "warning");
  }

  function openNewEmployee(user: User) {
    setNewFor(user);
    setAddError(null);
    setNewEmployee({ ...emptyEmployee, name: user.name, email: user.email });
  }

  async function createEmployee() {
    if (!newFor) return;
    if (!newEmployee.name.trim()) return setAddError("Name is required");
    setBusy("__new__");
    setAddError(null);
    try {
      const r = await fetch("/api/admin/users-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEmployee, linkUserId: newFor.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setAddError(j.error || "Couldn't create the employee");
      toastStore.show(`Employee created and linked to ${newFor.name}`);
      setNewFor(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-grey-100 bg-card p-10">
        <Loader2 className="h-5 w-5 animate-spin text-grey-400" />
      </div>
    );
  }

  const chips: { key: Filter; label: string; value: number; icon: typeof Users; accent: "primary" | "success" | "warning" | "error" }[] = [
    { key: "all", label: "All users", value: data.users.length, icon: Users, accent: "primary" },
    { key: "linked", label: "Linked", value: counts.linked, icon: CheckCircle2, accent: "success" },
    { key: "suggested", label: "Suggested", value: counts.suggested, icon: Sparkles, accent: "warning" },
    { key: "unlinked", label: "Not linked", value: counts.unlinked, icon: CircleDashed, accent: "error" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary chips double as filters */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn("rounded-xl text-left transition", filter === c.key ? "ring-2 ring-primary" : "hover:opacity-90")}
          >
            <KpiCard compact label={c.label} value={String(c.value)} icon={c.icon} accent={c.accent} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
        {counts.suggested > 0 && (
          <Button type="button" onClick={confirmAll} disabled={busy !== null}>
            {busy === "__all__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Confirm all suggestions ({counts.suggested})
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-light-600 text-left text-xs font-heading font-medium uppercase tracking-wider text-grey-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm font-body text-grey-400">
                  No users match.
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const state = stateOf(u);
              const suggestId = data.suggestions[u.id];
              const value = u.employeeId ?? suggestId ?? NONE;
              // This user's own employee + every employee nobody else has.
              const options = data.employees.filter((e) => !linkedEmpIds.has(e.id) || e.id === u.employeeId);
              return (
                <tr key={u.id} className="hover:bg-light-600/50">
                  <td className="px-4 py-3 align-middle">
                    <p className="font-body font-medium text-grey-900">{u.name}</p>
                    <p className="text-xs text-grey-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex rounded-full bg-primary-transparent px-2.5 py-1 text-xs font-body font-medium text-primary">
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="relative w-64">
                        <SelectField
                          value={value}
                          aria-label={`Employee for ${u.name}`}
                          disabled={busy !== null}
                          searchPlaceholder="Search employees"
                          addLabel="New employee"
                          onAddClick={() => openNewEmployee(u)}
                          onChange={(e) => {
                            const next = e.target.value === NONE ? null : e.target.value;
                            if (next !== u.employeeId) void link(u, next);
                          }}
                          className={cn(
                            "flex h-9 w-full items-center rounded-md border px-3 text-left text-sm font-body",
                            state === "suggested" ? "border-warning bg-warning-transparent text-grey-900" : "border-grey-200 text-grey-900",
                            state === "unlinked" && "text-grey-400"
                          )}
                        >
                          <option value={NONE}>{u.employeeId ? "— None (unlink) —" : "Pick employee…"}</option>
                          {options.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                              {e.department ? ` · ${e.department}` : ""}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                      {state === "suggested" && (
                        <Button type="button" size="sm" onClick={() => void link(u, suggestId)} disabled={busy !== null}>
                          {busy === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {state === "linked" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-transparent px-2.5 py-1 text-xs font-medium text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Linked
                      </span>
                    ) : state === "suggested" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2.5 py-1 text-xs font-medium text-warning-900">
                        <Sparkles className="h-3.5 w-3.5" /> Suggested
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-grey-transparent px-2.5 py-1 text-xs font-medium text-grey-600">
                        <CircleDashed className="h-3.5 w-3.5" /> Not linked
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Employees nobody logs in as (e.g. factory staff) — collapsed by default */}
      <div className="rounded-lg border border-grey-100 bg-card">
        <button
          type="button"
          onClick={() => setShowUnlinkedEmployees((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-heading font-semibold text-grey-900">
            Employees without a login <span className="font-number text-grey-500">({employeesWithoutLogin.length})</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-grey-400 transition-transform", showUnlinkedEmployees && "rotate-180")} />
        </button>
        {showUnlinkedEmployees && (
          <ul className="grid grid-cols-1 gap-2 border-t border-grey-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {employeesWithoutLogin.map((e) => (
              <li key={e.id} className="rounded-md border border-grey-100 px-3 py-2">
                <p className="text-sm font-body text-grey-900">{e.name}</p>
                <p className="text-xs text-grey-500">{[e.department, e.email].filter(Boolean).join(" · ") || "—"}</p>
              </li>
            ))}
            {employeesWithoutLogin.length === 0 && <li className="text-sm text-grey-400">Every employee has a login.</li>}
          </ul>
        )}
      </div>

      <Dialog open={newFor !== null} onOpenChange={(o) => !o && setNewFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New employee</DialogTitle>
            <DialogDescription>
              Creates an employee record and links it to {newFor?.name}. Use this for people who don&apos;t come in through the door-access sync.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ne-name">Name *</Label>
              <Input id="ne-name" value={newEmployee.name} onChange={(e) => setNewEmployee((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ne-email">Email</Label>
                <Input id="ne-email" type="email" value={newEmployee.email} onChange={(e) => setNewEmployee((v) => ({ ...v, email: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ne-phone">Phone</Label>
                <Input id="ne-phone" value={newEmployee.phone} onChange={(e) => setNewEmployee((v) => ({ ...v, phone: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ne-dept">Department</Label>
                <Input id="ne-dept" value={newEmployee.department} onChange={(e) => setNewEmployee((v) => ({ ...v, department: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ne-desig">Designation</Label>
                <Input id="ne-desig" value={newEmployee.designation} onChange={(e) => setNewEmployee((v) => ({ ...v, designation: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ne-empno">Employee number</Label>
              <Input id="ne-empno" value={newEmployee.employeeNumber} onChange={(e) => setNewEmployee((v) => ({ ...v, employeeNumber: e.target.value }))} />
            </div>
            {addError && <p className="text-xs text-error">{addError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewFor(null)}>Cancel</Button>
            <Button type="button" onClick={createEmployee} disabled={busy === "__new__" || !newEmployee.name.trim()}>
              {busy === "__new__" ? "Creating…" : "Create and link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
