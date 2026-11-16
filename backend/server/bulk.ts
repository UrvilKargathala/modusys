import "server-only";

// Full-collection replace: clear the table, then insert the incoming rows in
// a single createMany. These stores always send their COMPLETE array, so a
// straight delete-all + bulk-insert is correct — and it's two statements
// regardless of row count, avoiding the interactive-transaction timeout that
// per-row upserts hit over the serverless driver.
//
// Deliberately NOT wrapped in prisma.$transaction([...]) — Neon's serverless
// HTTP driver opening an interactive transaction session has been observed to
// fail outright with P2028 "Unable to start a transaction in the given time"
// (starving every write with no client-visible error, since api-sync.ts
// swallows the failed fetch). Two sequential statements lose atomicity
// (a reader could briefly see an empty table) but that's a better tradeoff
// than writes silently vanishing.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function replaceCollection<T extends { id: string }>(delegate: any, rows: T[]) {
  await delegate.deleteMany({});
  if (rows.length > 0) {
    await delegate.createMany({ data: rows });
  }
}

// ISO string → Date for DateTime columns (stores carry createdAt as ISO).
export function toDate(v: unknown): Date {
  return v ? new Date(v as string) : new Date();
}
