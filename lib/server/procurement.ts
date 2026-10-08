// Shared by the /api/procurement routes. Same people as the Quotes page.
export const PROCUREMENT_ROLES = ["super-admin", "admin"];

type Row = { id: string; quoteId: string; data: unknown; createdAt: Date; updatedAt: Date };
export const serializeProcurement = (r: Row) => ({ id: r.id, quoteId: r.quoteId, data: r.data, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });
