-- ============================================================================
-- 20260526060000_normalize_phone_numbers.sql
-- ----------------------------------------------------------------------------
-- One-time backfill: convert existing phone strings to canonical E.164.
--
-- Source columns:
--   • client_companies.phone           (text)
--   • contacts.phone                   (text)
--   • contacts.secondary_phone         (text — legacy single)
--   • contacts.secondary_phones        (jsonb array)
--   • profiles.phone                   (text)
--
-- Strategy:
--   We can't run libphonenumber-js inside Postgres, so we re-implement
--   *only* the Indonesian rule set the app uses today. Other formats are
--   left untouched (logged in audit table) so a human can review them.
--
-- Rules applied for each input phone string `raw`:
--   1. Strip everything except digits and a possibly-leading `+`.
--   2. If empty after step 1 → set NULL.
--   3. If string starts with `+` → keep as-is (already canonical).
--   4. If starts with `00` → replace `00` with `+` (intl prefix).
--   5. If starts with `62` and length >= 11 → prepend `+`.
--   6. If starts with `0`  → replace leading `0` with `+62`.
--   7. If first digit is 8 and length 9–13 → prepend `+62`
--      (bare-mobile heuristic; matches client-side util).
--   8. Otherwise → leave unchanged (will be flagged in audit table).
--
-- The migration is idempotent: rows already in `+xxx` form pass through
-- unchanged in step 3.
--
-- Audit:
--   We create `phone_normalization_audit` with the original value, the
--   normalised value, the table+column the row came from, and a status
--   flag. After the backfill runs, query
--     SELECT * FROM phone_normalization_audit WHERE status='unchanged'
--   to triage whatever needs manual cleanup.
-- ============================================================================

-- ── Audit table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_normalization_audit (
    id           BIGSERIAL PRIMARY KEY,
    source_table TEXT NOT NULL,
    source_column TEXT NOT NULL,
    row_id       UUID,
    raw_value    TEXT,
    new_value    TEXT,
    status       TEXT NOT NULL CHECK (status IN ('changed','unchanged','cleared')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_normalization_audit_status_idx
    ON phone_normalization_audit (status);

-- ── Pure SQL canonicalizer ───────────────────────────────────────────────────
-- Returns NULL for empty / unparseable / invalid input.
-- Returns the canonical "+xxxx" string otherwise (Indonesian heuristics).
--
-- IMMUTABLE so we can call it freely in UPDATE / SELECT.
CREATE OR REPLACE FUNCTION fn_normalize_phone_id(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    cleaned TEXT;
    has_plus BOOLEAN;
BEGIN
    IF raw IS NULL THEN RETURN NULL; END IF;

    -- keep `+` (only if leading) and digits
    has_plus := substring(raw, 1, 1) = '+' OR substring(btrim(raw), 1, 1) = '+';
    cleaned := regexp_replace(raw, '[^0-9]', '', 'g');

    IF cleaned IS NULL OR length(cleaned) = 0 THEN RETURN NULL; END IF;

    -- already +-prefixed → keep
    IF has_plus THEN
        RETURN '+' || cleaned;
    END IF;

    -- "00xx..." intl dial-out prefix → "+xx..."
    IF left(cleaned, 2) = '00' AND length(cleaned) >= 5 THEN
        RETURN '+' || substring(cleaned from 3);
    END IF;

    -- "62xxx..." → "+62xxx..."
    IF left(cleaned, 2) = '62' AND length(cleaned) >= 11 THEN
        RETURN '+' || cleaned;
    END IF;

    -- "0xxx..." → "+62xxx..." (drop leading 0, prepend +62)
    IF left(cleaned, 1) = '0' AND length(cleaned) >= 9 THEN
        RETURN '+62' || substring(cleaned from 2);
    END IF;

    -- bare mobile "8xxx..." (no leading 0) → "+628xxx..."
    IF left(cleaned, 1) = '8' AND length(cleaned) BETWEEN 9 AND 13 THEN
        RETURN '+62' || cleaned;
    END IF;

    -- couldn't classify → return NULL so caller leaves row untouched
    RETURN NULL;
END;
$$;

-- ── Reusable backfill macro ──────────────────────────────────────────────────
-- We can't templatize as a function easily because of the audit insert
-- pattern. Inline blocks are easier to read and review.

-- ───── client_companies.phone ───────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    new_v TEXT;
BEGIN
    FOR rec IN SELECT id, phone FROM client_companies WHERE phone IS NOT NULL AND phone <> '' LOOP
        new_v := fn_normalize_phone_id(rec.phone);
        IF new_v IS NULL THEN
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('client_companies','phone',rec.id, rec.phone, NULL, 'unchanged');
        ELSIF new_v <> rec.phone THEN
            UPDATE client_companies SET phone = new_v WHERE id = rec.id;
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('client_companies','phone',rec.id, rec.phone, new_v, 'changed');
        END IF;
    END LOOP;
END $$;

-- ───── contacts.phone ───────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    new_v TEXT;
BEGIN
    FOR rec IN SELECT id, phone FROM contacts WHERE phone IS NOT NULL AND phone <> '' LOOP
        new_v := fn_normalize_phone_id(rec.phone);
        IF new_v IS NULL THEN
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('contacts','phone',rec.id, rec.phone, NULL, 'unchanged');
        ELSIF new_v <> rec.phone THEN
            UPDATE contacts SET phone = new_v WHERE id = rec.id;
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('contacts','phone',rec.id, rec.phone, new_v, 'changed');
        END IF;
    END LOOP;
END $$;

-- ───── contacts.secondary_phone ─────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    new_v TEXT;
BEGIN
    FOR rec IN SELECT id, secondary_phone FROM contacts WHERE secondary_phone IS NOT NULL AND secondary_phone <> '' LOOP
        new_v := fn_normalize_phone_id(rec.secondary_phone);
        IF new_v IS NULL THEN
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('contacts','secondary_phone',rec.id, rec.secondary_phone, NULL, 'unchanged');
        ELSIF new_v <> rec.secondary_phone THEN
            UPDATE contacts SET secondary_phone = new_v WHERE id = rec.id;
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('contacts','secondary_phone',rec.id, rec.secondary_phone, new_v, 'changed');
        END IF;
    END LOOP;
END $$;

-- ───── contacts.secondary_phones (jsonb array of strings) ───────────────────
DO $$
DECLARE
    rec RECORD;
    elem TEXT;
    rebuilt JSONB;
    norm TEXT;
    changed BOOLEAN;
BEGIN
    FOR rec IN SELECT id, secondary_phones FROM contacts
               WHERE secondary_phones IS NOT NULL
                 AND jsonb_typeof(secondary_phones) = 'array'
                 AND jsonb_array_length(secondary_phones) > 0
    LOOP
        rebuilt := '[]'::jsonb;
        changed := FALSE;
        FOR elem IN SELECT jsonb_array_elements_text(rec.secondary_phones) LOOP
            norm := fn_normalize_phone_id(elem);
            IF norm IS NULL THEN
                rebuilt := rebuilt || to_jsonb(elem);
                INSERT INTO phone_normalization_audit
                    (source_table, source_column, row_id, raw_value, new_value, status)
                VALUES ('contacts','secondary_phones',rec.id, elem, NULL, 'unchanged');
            ELSE
                rebuilt := rebuilt || to_jsonb(norm);
                IF norm <> elem THEN
                    INSERT INTO phone_normalization_audit
                        (source_table, source_column, row_id, raw_value, new_value, status)
                    VALUES ('contacts','secondary_phones',rec.id, elem, norm, 'changed');
                    changed := TRUE;
                END IF;
            END IF;
        END LOOP;
        IF changed THEN
            UPDATE contacts SET secondary_phones = rebuilt WHERE id = rec.id;
        END IF;
    END LOOP;
END $$;

-- ───── profiles.phone ───────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    new_v TEXT;
BEGIN
    FOR rec IN SELECT id, phone FROM profiles WHERE phone IS NOT NULL AND phone <> '' LOOP
        new_v := fn_normalize_phone_id(rec.phone);
        IF new_v IS NULL THEN
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('profiles','phone',rec.id, rec.phone, NULL, 'unchanged');
        ELSIF new_v <> rec.phone THEN
            UPDATE profiles SET phone = new_v WHERE id = rec.id;
            INSERT INTO phone_normalization_audit
                (source_table, source_column, row_id, raw_value, new_value, status)
            VALUES ('profiles','phone',rec.id, rec.phone, new_v, 'changed');
        END IF;
    END LOOP;
END $$;
