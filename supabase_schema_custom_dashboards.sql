CREATE TABLE IF NOT EXISTS public.custom_dashboard_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    subdomain TEXT NOT NULL UNIQUE,
    layout TEXT NOT NULL DEFAULT 'standard',
    theme TEXT NOT NULL DEFAULT 'sky',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'custom_dashboard_domains'
            AND column_name = 'layout'
    ) THEN
        ALTER TABLE public.custom_dashboard_domains ADD COLUMN layout TEXT NOT NULL DEFAULT 'standard';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'custom_dashboard_domains'
            AND column_name = 'theme'
    ) THEN
        ALTER TABLE public.custom_dashboard_domains ADD COLUMN theme TEXT NOT NULL DEFAULT 'sky';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'custom_dashboard_domains'
            AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.custom_dashboard_domains ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'custom_dashboard_domains'
            AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.custom_dashboard_domains ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

ALTER TABLE public.custom_dashboard_domains
DROP CONSTRAINT IF EXISTS custom_dashboard_domains_layout_check;

ALTER TABLE public.custom_dashboard_domains
ADD CONSTRAINT custom_dashboard_domains_layout_check
CHECK (layout IN ('standard', 'compact', 'spacious', 'floating_dock', 'split_sidebar', 'minimalist_drawer'));

ALTER TABLE public.custom_dashboard_domains
DROP CONSTRAINT IF EXISTS custom_dashboard_domains_theme_check;

ALTER TABLE public.custom_dashboard_domains
ADD CONSTRAINT custom_dashboard_domains_theme_check
CHECK (theme IN ('sky', 'emerald', 'violet', 'rose', 'amber', 'cyan', 'slate'));

CREATE INDEX IF NOT EXISTS custom_dashboard_domains_server_id_idx
ON public.custom_dashboard_domains(server_id);
