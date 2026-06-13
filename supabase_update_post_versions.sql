-- Split update post release metadata into Ro-Link and plugin versions.
-- Existing version values become the Ro-Link version for compatibility.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'update_posts'
            AND column_name = 'rolink_version'
    ) THEN
        ALTER TABLE public.update_posts
        ADD COLUMN rolink_version TEXT NOT NULL DEFAULT 'V2.01.0';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'update_posts'
            AND column_name = 'plugin_version'
    ) THEN
        ALTER TABLE public.update_posts
        ADD COLUMN plugin_version TEXT;
    END IF;
END $$;

UPDATE public.update_posts
SET version = 'V2.01.0'
WHERE version IS NULL OR btrim(version) = '';

UPDATE public.update_posts
SET rolink_version = version
WHERE rolink_version IS NULL OR btrim(rolink_version) = '';

ALTER TABLE public.update_posts
ALTER COLUMN rolink_version SET DEFAULT 'V2.01.0',
ALTER COLUMN rolink_version SET NOT NULL;
