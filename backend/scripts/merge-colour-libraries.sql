-- Merges the External Colour list into the Internal Colour list (the single "Colour" list) for the Purchase Material Library and the
-- Proforma Library. Same effect as scripts/merge-colour-libraries.ts, for running inside the database container.
-- Entries with the same brand + code are reused, the rest are copied; Purchase Furniture Price rows are re-pointed; old External
-- entries are soft-deleted (not dropped). Safe to re-run.
--
--   dry run (changes nothing):  psql ... -v finish=ROLLBACK -f merge-colour-libraries.sql
--   apply:                      psql ... -v finish=COMMIT   -f merge-colour-libraries.sql
BEGIN;

CREATE TEMP TABLE ext ON COMMIT DROP AS
SELECT e.id AS ext_id, e.category, e.name, e.description,
       (SELECT i.id FROM "MaterialItem" i
         WHERE i.category = replace(e.category, '-external', '-internal') AND NOT i.deleted
           AND lower(trim(i.name)) = lower(trim(e.name)) AND lower(trim(i.description)) = lower(trim(e.description))
         LIMIT 1) AS int_id,
       'mi-' || md5(replace(e.category, '-external', '-internal') || '|' || lower(trim(e.name)) || '|' || lower(trim(e.description))) AS new_id
FROM "MaterialItem" e
WHERE e.category IN ('purchase-external', 'proforma-external') AND NOT e.deleted;

INSERT INTO "MaterialItem" (id, category, name, description, deleted, "createdAt")
SELECT DISTINCT ON (new_id) new_id, replace(category, '-external', '-internal'), name, description, false, now()
FROM ext WHERE int_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE "PurchaseFurniturePriceItem" p
SET "externalColourId" = COALESCE(ext.int_id, ext.new_id)
FROM ext
WHERE ext.ext_id = p."externalColourId" AND ext.category = 'purchase-external';

UPDATE "MaterialItem" SET deleted = true WHERE id IN (SELECT ext_id FROM ext);

SELECT (SELECT count(*) FROM ext) AS external_entries,
       (SELECT count(*) FROM ext WHERE int_id IS NULL) AS copied_into_colour,
       (SELECT count(*) FROM ext WHERE int_id IS NOT NULL) AS already_in_colour;

:finish;
