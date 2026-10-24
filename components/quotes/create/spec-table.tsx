import type { ReactNode } from "react";

// Shared table layout for the Customer Details and Material Specification tabs:
// two label + value pairs per row, a pink header, a divider between the pairs.
export function SpecTable({ children }: { children: ReactNode }) {
  return (
    <div className="spec-table overflow-x-auto rounded-lg border border-grey-100 bg-card">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="bg-[var(--table-head)] text-left text-sm font-medium text-grey-900">
            <th className="px-3 py-1.5">Field</th>
            <th className="px-3 py-1.5">Selection</th>
            <th className="border-l border-grey-200 px-3 py-1.5">Field</th>
            <th className="px-3 py-1.5">Selection</th>
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-grey-100 [&>tr:last-child]:border-b-0 [&_td:nth-child(3)]:border-l [&_td:nth-child(3)]:border-l-grey-200">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function L({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <td className="w-44 whitespace-nowrap border-r border-grey-100 bg-white px-3 py-1 text-sm font-body font-semibold text-grey-900">
      {children}
      {required && <span className="text-error"> *</span>}
    </td>
  );
}

export function V({ children, span }: { children: ReactNode; span?: number }) {
  return (
    <td colSpan={span} className="min-w-0 px-2 py-1 align-top">
      {children}
    </td>
  );
}

export function SectionRow({ children }: { children: ReactNode }) {
  return <td colSpan={4} className="bg-primary-transparent px-3 py-1 text-sm font-body font-semibold text-primary">{children}</td>;
}
