-- Make update posts draft-first and publishable later.
-- Existing posts with a publish timestamp stay published.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'update_posts'
            AND column_name = 'status'
    ) THEN
        ALTER TABLE public.update_posts ADD COLUMN status TEXT NOT NULL DEFAULT 'DRAFT';
    END IF;
END $$;

ALTER TABLE public.update_posts
ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE public.update_posts
ALTER COLUMN published_at DROP NOT NULL,
ALTER COLUMN published_at DROP DEFAULT;

UPDATE public.update_posts
SET status = 'PUBLISHED'
WHERE published_at IS NOT NULL AND status IS DISTINCT FROM 'PUBLISHED';

UPDATE public.update_posts
SET status = 'DRAFT'
WHERE published_at IS NULL AND status IS DISTINCT FROM 'DRAFT';

ALTER TABLE public.update_posts
ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'update_posts_status_check'
            AND conrelid = 'public.update_posts'::regclass
    ) THEN
        ALTER TABLE public.update_posts
        ADD CONSTRAINT update_posts_status_check CHECK (status IN ('DRAFT', 'PUBLISHED'));
    END IF;
END $$;
