# Purchase Orders — plan (not built)

Source: `PURCHASE ORDER.xlsx` (sheet "PO"). A PO is sent to a manufacturing vendor with a customer's cut-list, created from a quote.

## Decisions so far
| # | Topic | Decision |
|---|---|---|
| 1 | Rate | Entered **manually** per line. Quote selling rates are never reused. |
| 2 | PO number | Based on the **customer code**; exact format **will be decided later**. Until then the number is typed manually. |
| 3 | Which quote status can create a PO | **Will be decided later.** Button is not gated until then. |
| 4 | PO statuses | **None defined.** Do not invent any; no status column/badge until the user defines them. |
| 5 | PO contents | **All of it:** carcass, shutter, other panels **and hardware** (group D Hardware, from each cabinet's `hardware`). |
| 6 | Tandem panel sizes | From the **quote's formulas** (`evaluateFormula` / `resolveLineItemDimensions` in `lib/quote-pricing.ts`). Panel Calculator specs not used. |
| 7 | Required date | PO date + 10 days by default, editable. |
| 8 | Vendors | **Several** vendors; one vendor per PO; one quote can have many POs. |
| 9 | Sr no | **Per cabinet**, following the quote's cabinet order. |

## Flow
1. Quote → "Create Purchase Order" → draft PO.
2. Cut-list is snapshotted from the quote (carcass components, shutter/external finishes, other panels per cabinet) as groups A Carcass / B Shutter / C Other Panel / D Hardware. Hardware has no section in the Excel, so its columns (article no, brand, category, qty, unit, rate, amount) are new. Later quote edits do not change an issued PO.
3. Material block (shutter + other raw material, internal 1–2, external 1–3) comes from the quote header.
4. Design type code (MTU-01, WU-02…) = unit type short code + running number.
5. User picks vendor, required date, fills rate per line and remarks; lines are editable (remarks, qty, extra panels).
6. Totals: amount, special discount, GST, round off, final. PDF export in the sheet's layout.

## Data (additive only, needs the CLAUDE.md §6 database plan first)
- `Vendor`: name, address, state, GST no, contacts.
- `PurchaseOrder`: number, date, requiredDate, vendorId, quoteId, customerId, material block, discountPct, gstMode, round off, remarks.
- `PurchaseOrderLine`: poId, group (A/B/C/D), srNo, description, designType, W, D, H, qty, sqft, internal/external colour, material, rate, remarks.

## Calculation rules to fix versus the Excel
- Sheet total is `=SUM(#REF!)` and rate/amount columns are empty: amount = rate × sq.ft per line, summed.
- Tandem rows multiply qty twice in sq.ft; use qty once.
- GST: intra-state = 9% state + 9% central; inter-state = 18% IGST. Chosen from vendor state vs company state (Gujarat). The sheet hard-codes IGST to 0.
- Carcass sq.ft in the sheet is a fixed 3-part formula; the quote engine is per component. Use the quote engine so quote and PO agree, and check against this sheet's numbers.
- Column W ("2" on tandem rows) is unexplained; not carried over unless explained.

## Screens
PO list (shared list-page shell), PO detail/editor in the sheet's layout, Vendors list/form, "Create PO" on the quote screen.

## Phases
1. Resolve open questions, agree DB plan.
2. Vendors + PO tables + list screen.
3. Quote → PO conversion + editor.
4. PDF export. Statuses/notifications only after the user defines them.

## Open questions
- PO number format and which quote status can create a PO: user will decide later (not blocking Phase 2).
- Hardware lines: the sheet has no hardware layout. Confirm columns (article no, brand, category, qty, unit, rate, amount) and whether the vendor for hardware can differ from the panel vendor (several vendors per quote is already allowed).
- Sr no per cabinet: confirm it is the cabinet's running number in the quote (shared by its carcass, shutter, panel and hardware lines), not a count per group.
