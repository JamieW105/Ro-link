-- Remove the eight stale "Unknown (Bot Left)" server records shown in the
-- dashboard on 2026-08-25.
--
-- Run this in the Supabase SQL Editor while connected to the Ro-Link project.
-- The script deletes only rows associated with the IDs below. It discovers
-- current foreign-key dependencies on public.servers, so it does not depend
-- solely on the application's hard-coded child-table list.

BEGIN;

CREATE TEMP TABLE rolink_servers_to_remove (
    id TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO rolink_servers_to_remove (id)
VALUES
    ('1416346618705477724'),
    ('1477952851165581358'),
    ('1511123307271946341'),
    ('1520100975694581903'),
    ('1270170232387801138'),
    ('1536211492280737882'),
    ('1539014479277195396'),
    ('1514835875601842177');

-- Preview the matching parent rows before deleting anything.
SELECT s.*
FROM public.servers AS s
JOIN rolink_servers_to_remove AS target ON target.id = s.id
ORDER BY s.id;

DO $cleanup$
DECLARE
    dependency RECORD;
    deleted_rows BIGINT;
BEGIN
    -- Clean the legacy tables used by the dashboard removal endpoint. Guards
    -- allow the script to work if a table has not been installed in this DB.
    FOR dependency IN
        SELECT table_name
        FROM (VALUES
            ('logs'),
            ('live_servers'),
            ('command_queue'),
            ('dashboard_roles'),
            ('reports'),
            ('server_addon_modules'),
            ('server_custom_modules')
        ) AS legacy(table_name)
        WHERE EXISTS (
            SELECT 1
            FROM information_schema.columns AS col
            WHERE col.table_schema = 'public'
              AND col.table_name = legacy.table_name
              AND col.column_name = 'server_id'
        )
    LOOP
        EXECUTE format(
            'DELETE FROM public.%I WHERE server_id IN (SELECT id FROM pg_temp.rolink_servers_to_remove)',
            dependency.table_name
        );
        GET DIAGNOSTICS deleted_rows = ROW_COUNT;
        RAISE NOTICE 'Deleted % row(s) from public.%', deleted_rows, dependency.table_name;
    END LOOP;

    -- Delete rows from every current table whose foreign key points at
    -- public.servers(id). This covers tables added after the API list above.
    FOR dependency IN
        SELECT DISTINCT
            child_namespace.nspname AS table_schema,
            child_table.relname AS table_name,
            child_column.attname AS column_name
        FROM pg_constraint AS constraint_record
        JOIN pg_class AS parent_table
          ON parent_table.oid = constraint_record.confrelid
        JOIN pg_namespace AS parent_namespace
          ON parent_namespace.oid = parent_table.relnamespace
        JOIN pg_class AS child_table
          ON child_table.oid = constraint_record.conrelid
        JOIN pg_namespace AS child_namespace
          ON child_namespace.oid = child_table.relnamespace
        JOIN LATERAL unnest(constraint_record.conkey) WITH ORDINALITY
          AS child_key(attnum, position) ON TRUE
        JOIN LATERAL unnest(constraint_record.confkey) WITH ORDINALITY
          AS parent_key(attnum, position)
          ON parent_key.position = child_key.position
        JOIN pg_attribute AS child_column
          ON child_column.attrelid = child_table.oid
         AND child_column.attnum = child_key.attnum
        JOIN pg_attribute AS parent_column
          ON parent_column.attrelid = parent_table.oid
         AND parent_column.attnum = parent_key.attnum
        WHERE constraint_record.contype = 'f'
          AND parent_namespace.nspname = 'public'
          AND parent_table.relname = 'servers'
          AND parent_column.attname = 'id'
        ORDER BY child_namespace.nspname, child_table.relname, child_column.attname
    LOOP
        EXECUTE format(
            'DELETE FROM %I.%I WHERE %I IN (SELECT id FROM pg_temp.rolink_servers_to_remove)',
            dependency.table_schema,
            dependency.table_name,
            dependency.column_name
        );
        GET DIAGNOSTICS deleted_rows = ROW_COUNT;
        RAISE NOTICE 'Deleted % row(s) from %.%',
            deleted_rows,
            dependency.table_schema,
            dependency.table_name;
    END LOOP;

    DELETE FROM public.servers
    WHERE id IN (SELECT id FROM rolink_servers_to_remove);

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RAISE NOTICE 'Deleted % row(s) from public.servers', deleted_rows;
END
$cleanup$;

-- Abort the whole transaction if any target parent row survived.
DO $verify$
DECLARE
    remaining_ids TEXT;
BEGIN
    SELECT string_agg(s.id, ', ' ORDER BY s.id)
    INTO remaining_ids
    FROM public.servers AS s
    JOIN rolink_servers_to_remove AS target ON target.id = s.id;

    IF remaining_ids IS NOT NULL THEN
        RAISE EXCEPTION 'Removal failed; these server IDs remain: %', remaining_ids;
    END IF;
END
$verify$;

COMMIT;

