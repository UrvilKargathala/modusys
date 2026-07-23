import "server-only";
import { prisma } from "@/lib/server/prisma";

// Full-collection replace: clear the table, then insert the incoming rows in
// a single createMany. These stores always send their COMPLETE array, so a
// straight delete-all + bulk-insert is correct — and it's two statements
// regardless of row count, avoiding the interactive-transaction timeout that
// per-row upserts hit over the serverless driver. Ids are preserved because
// each row carries its own id. Wrapped in a transaction so there's no window
// where the table is empty for concurrent readers.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function replaceCollection<T extends { id: string }>(delegate: any, rows: T[]) {
  if (rows.length === 0) {
    await delegate.deleteMany({});
    return;
  }
  await prisma.$transaction([
    delegate.deleteMany({}),
    delegate.createMany({ data: rows }),
  ]);
}

// ISO string → Date for DateTime columns (stores carry createdAt as ISO).
export function toDate(v: unknown): Date {
  return v ? new Date(v as string) : new Date();
}
