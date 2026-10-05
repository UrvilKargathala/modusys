# Purchase Orders — database plan (CLAUDE.md §6)

Status: **plan only, nothing applied.** Product plan: `docs/PURCHASE_ORDERS_PLAN.md`.

## 1. Scope of the change
Three **new tables**, one migration. No existing table or column is edited, renamed or dropped. Existing rows are untouched, so the change is additive and safe to roll back by leaving the tables unused.

Follows existing schema conventions:
- `id String @id @default(cuid())` (like `Customer`, `Task`).
- No Prisma enums; free strings (like `Task.status`).
- Links to other tables are **plain `String` ids, not FK relations** (like `Task.linkedCustomerId`, `Quote.customerId`), so deleting a customer/quote never cascades into POs. The app resolves rows live. The one real relation is PO → its own lines.
- Dates the user types are ISO `yyyy-mm-dd` strings where the sheet uses plain dates (like `Task.dueDate`, `Quote.date`); `createdAt`/`updatedAt` are `DateTime`.
- Soft delete with `deletedAt` where a record can disappear from lists (like `Customer`).

## 2. Proposed schema (draft, to review before it touches `schema.prisma`)

```prisma
// A manufacturing/material vendor a Purchase Order is sent to.
model Vendor {
  id        String    @id @default(cuid())
  name      String
  address   String    @default("")
  city      String    @default("")
  state     String    @default("")   // drives GST mode (vendor state vs Gujarat)
  gst       String    @default("")
  // [{ name, phone }] — the sheet has two contact rows
  contacts  Json      @default("[]")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([deletedAt])
}

model PurchaseOrder {
  id            String    @id @default(cuid())
  poNumber      String    // typed by hand for now (format decided later)
  poDate        String    @default("")  // yyyy-mm-dd
  requiredDate  String    @default("")  // defaults to poDate + 10 days, editable
  vendorId      String                   // plain id, no FK
  quoteId       String?
  customerId    String?
  // Snapshot of the "Material Description" block: shutter/other raw material,
  // internal colour 1-2, external colour 1-3 (names as text, frozen at create).
  material      Json      @default("{}")
  discountPct   Float     @default(0)
  gstMode       String    @default("intra") // "intra" (9%+9%) | "inter" (18% IGST)
  roundOff      Float     @default(0)
  remarks       String    @default("")
  createdById   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  lines PurchaseOrderLine[]

  @@index([vendorId])
  @@index([quoteId])
  @@index([customerId])
  @@index([deletedAt])
}

model PurchaseOrderLine {
  id             String   @id @default(cuid())
  poId           String
  po             PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  group          String   // "carcass" | "shutter" | "other-panel" | "hardware"
  srNo           Int      @default(0)    // cabinet running number from the quote
  position       Int      @default(0)    // order inside the PO
  description    String   @default("")
  designType     String   @default("")   // unit type short code + number, e.g. MTU-01
  width          Float    @default(0)    // mm, already evaluated from quote formulas
  depth          Float    @default(0)    // mm (shutters/panels: thickness, e.g. 18)
  height         Float    @default(0)
  qty            Float    @default(1)
  sqft           Float    @default(0)
  internalColour String   @default("")
  externalColour String   @default("")
  material       String   @default("")   // e.g. BWP PLY / BIRCH PLY
  // hardware lines only (empty for panel lines)
  articleNo      String   @default("")
  brand          String   @default("")
  category       String   @default("")
  unit           String   @default("")
  rate           Float    @default(0)    // typed manually
  remarks        String   @default("")

  @@index([poId])
}
```

Deliberately **not** included:
- No `status` column: statuses are not defined yet. They can be added later as an additive column.
- No PO-number uniqueness/sequence: format undecided. Adding a unique index later is additive (after checking existing values).
- No stored totals: amount/discount/GST/final are computed from lines (like quote totals are computed), so they cannot drift.

Open model questions to settle before writing the migration:
1. Should `Vendor` have a notes field or bank details? (Not in the sheet; left out.)
2. Hardware `unit`/`brand`/`category` as text snapshots (as above) versus ids into the existing hardware price list. Text snapshot is proposed so a later catalog edit does not rewrite an issued PO.

## 3. Execution order (all steps need an explicit yes in this conversation)

**Release timing (decided):** all work stays on `work-code` and is tested on staging. Nothing is merged into `garage-migration` until every PO screen is finished and final; the production dump (step 4), production migration (step 5) and deploy (steps 6-7) all happen once, at the end.

1. **Branch:** create the work branch from `garage-migration`. Edit `prisma/schema.prisma` only; generate the migration folder with `prisma migrate dev --create-only` against a **local/staging** DB and review the SQL by eye: it must contain only `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE ... ADD CONSTRAINT` for the three new tables and nothing else. Any `DROP`, `ALTER COLUMN` or change to an existing table = stop.
2. **Staging first:** apply with `prisma migrate deploy` to the staging test database (SSH tunnel, app on port 3100). Check the tables exist, create a vendor and a PO through the staging app, check indexes with `\d`.
3. **Build and test the feature on staging** (vendors, create-from-quote, editor) with `npm run check` passing, before production is touched.
4. **Dump production before touching it:** `pg_dump` of `modusys-production` (custom format) into a path outside git, record file size and checksum, test that it lists with `pg_restore --list`. Server password files stay in `~/prod/*.env`; no secret is printed in chat or logs.
5. **Apply to production just before the deploy:** `prisma migrate deploy` against production, then confirm the three tables exist and existing row counts (customers, quotes, architects) are unchanged.
6. **Deploy:** merge to `garage-migration`, `npm run check`, push, then the user presses Deploy in Coolify. Never from a session.
7. **Verify** the new container runs the expected commit, the site answers, and the PO screens load.

Order matters in one direction: the tables must exist in production **before** the new code that reads them is deployed, otherwise the PO pages error. The old app version ignores the new tables, so applying early is harmless.

## 4. Rollback
- **Code:** in Coolify redeploy the previous good deployment. The extra tables are simply unused.
- **Tables:** because nothing existing was changed, rollback never requires restoring the dump. If the tables must go, `DROP TABLE` on the three new tables only, after the user says yes and only if no PO data worth keeping exists.
- **Dump:** the pre-change dump is the last-resort restore point and is kept until the feature has run cleanly.

## 5. Risks and checks
| Risk | Check |
|---|---|
| Migration touches existing data | Read the generated SQL before applying; allow only `CREATE` statements. |
| Staging drifts from production schema | Compare `_prisma_migrations` in both before applying. |
| Coolify does not run migrations | Step 5 is a manual step; never assume deploy migrates. |
| Hand-typed PO numbers collide | No unique index yet; duplicates are visible in the list. Revisit when the format is decided. |
| Line numbers drift from the quote | Lines are snapshots by design; the editor can re-pull from the quote only on an explicit user action. |

## 6. Nothing happens until you say so
Next steps, each needing your yes: (a) review/adjust section 2, (b) I add it to `schema.prisma` on a work branch and generate the migration for review, (c) staging apply.
