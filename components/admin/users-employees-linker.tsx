"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Unlink } from "lucide-react";

type User = { id: string; name: string; email: string; role: string; status: string; employeeId: string | null };
type Employee = { id: string; name: string; email: string | null; department: string | null; employeeNumber: string | null };
type Data = { users: User[]; employees: Employee[]; suggestions: Record<string, string> };

export function UsersEmployeesLinker() {
  const [data, setData] = useState<Data | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pickerEmpId, setPickerEmpId] = useState<string>("");

  async function load() {
    const r = await fetch("/api/admin/users-employees", { cache: "no-store" });
    const j: Data = await r.json();
    setData(j);
  }
  useEffect(() => {
    load();
  }, []);

  const linkedEmpIds = useMemo(
    () => new Set((data?.users || []).map((u) => u.employeeId).filter(Boolean) as string[]),
    [data]
  );
  const employeeById = useMemo(
    () => new Map((data?.employees || []).map((e) => [e.id, e])),
    [data]
  );
  const availableEmployees = useMemo(() => {
    if (!data) return [];
    // The current user's linked employee should still be in the list (so the
    // dropdown shows it as selected), plus every employee not already linked
    // elsewhere.
    const selected = data.users.find((u) => u.id === selectedUserId);
    return data.employees.filter(
      (e) => !linkedEmpIds.has(e.id) || e.id === selected?.employeeId
    );
  }, [data, linkedEmpIds, selectedUserId]);

  async function link(userId: string, employeeId: string | null) {
    setBusyId(userId);
    setError(null);
    try {
      const r = await fetch("/api/admin/users-employees/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, employeeId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Failed");
        return;
      }
      await load();
      setSelectedUserId(null);
      setPickerEmpId("");
    } finally {
      setBusyId(null);
    }
  }

  if (!data) {
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-grey-400" />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left: users */}
      <Card className="lg:col-span-2 overflow-hidden p-0">
        <div className="border-b border-grey-100 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-grey-900">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-light-600 text-left text-xs font-heading font-medium uppercase tracking-wider text-grey-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Linked Employee</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {data.users.map((u) => {
                const linked = u.employeeId ? employeeById.get(u.employeeId) : null;
                const suggestId = data.suggestions[u.id];
                const suggest = suggestId ? employeeById.get(suggestId) : null;
                return (
                  <tr key={u.id} className={selectedUserId === u.id ? "bg-primary-transparent" : "hover:bg-light-600/50"}>
                    <td className="px-4 py-2 align-top">
                      <p className="font-body font-medium text-grey-900">{u.name}</p>
                      <p className="text-xs text-grey-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-2 align-top text-grey-700">{u.role}</td>
                    <td className="px-4 py-2 align-top">
                      {linked ? (
                        <div>
                          <p className="text-grey-900">{linked.name}</p>
                          {linked.department && <p className="text-xs text-grey-500">{linked.department}</p>}
                        </div>
                      ) : suggest ? (
                        <button
                          type="button"
                          onClick={() => link(u.id, suggest.id)}
                          disabled={busyId === u.id}
                          className="text-left"
                        >
                          <p className="text-primary hover:underline">Suggested: {suggest.name}</p>
                          <p className="text-xs text-grey-500">Click to link</p>
                        </button>
                      ) : (
                        <span className="text-xs italic text-grey-400">not linked</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      {linked ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => link(u.id, null)}
                          disabled={busyId === u.id}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Unlink
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setPickerEmpId(suggestId || "");
                          }}
                          disabled={busyId === u.id}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Link…
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Right: picker + employee list */}
      <Card className="flex flex-col gap-3 p-4">
        {selectedUserId ? (
          <>
            <div>
              <p className="text-xs font-body font-medium uppercase tracking-wide text-grey-500">Linking</p>
              <p className="font-body text-grey-900">
                {data.users.find((u) => u.id === selectedUserId)?.name}
              </p>
              <p className="text-xs text-grey-500">
                {data.users.find((u) => u.id === selectedUserId)?.email}
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs font-body font-medium text-grey-500">
              Employee record
              <select
                value={pickerEmpId}
                onChange={(e) => setPickerEmpId(e.target.value)}
                className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900"
              >
                <option value="">— pick one —</option>
                {availableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}{e.email ? ` · ${e.email}` : ""}{e.department ? ` · ${e.department}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedUserId(null);
                  setPickerEmpId("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => selectedUserId && pickerEmpId && link(selectedUserId, pickerEmpId)}
                disabled={!pickerEmpId || busyId !== null}
              >
                {busyId === selectedUserId ? "Saving…" : "Save link"}
              </Button>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-body text-grey-500">
              Pick a user on the left to link, or click a Suggested match to link it directly.
            </p>
            <div className="mt-2">
              <p className="text-xs font-body font-medium uppercase tracking-wide text-grey-500">Active employees ({data.employees.length})</p>
              <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto text-sm">
                {data.employees.map((e) => (
                  <li key={e.id} className="rounded border border-grey-100 px-2 py-1.5">
                    <p className={linkedEmpIds.has(e.id) ? "text-grey-400 line-through" : "text-grey-900"}>{e.name}</p>
                    {e.email && <p className="text-xs text-grey-500">{e.email}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
