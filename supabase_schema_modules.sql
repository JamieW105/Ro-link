-- Add-on Module Marketplace
CREATE TABLE IF NOT EXISTS public.addon_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '1.0.0',
    category TEXT NOT NULL DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
    source_code TEXT NOT NULL,
    source_checksum TEXT NOT NULL,
    config_schema JSONB NOT NULL DEFAULT '{}',
    author_discord_id TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by_discord_id TEXT,
    moderation_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_addon_modules_status
    ON public.addon_modules(status);

CREATE INDEX IF NOT EXISTS idx_addon_modules_category
    ON public.addon_modules(category);

ALTER TABLE public.addon_modules
    ADD COLUMN IF NOT EXISTS config_schema JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.addon_modules
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by_discord_id TEXT,
    ADD COLUMN IF NOT EXISTS moderation_note TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'addon_modules_status_check'
    ) THEN
        ALTER TABLE public.addon_modules DROP CONSTRAINT addon_modules_status_check;
    END IF;
END $$;

ALTER TABLE public.addon_modules
    ADD CONSTRAINT addon_modules_status_check
    CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'));

CREATE TABLE IF NOT EXISTS public.addon_module_creator_blocks (
    discord_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    blocked_by_discord_id TEXT,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_module_creator_blocks_active
    ON public.addon_module_creator_blocks(active);

CREATE TABLE IF NOT EXISTS public.server_addon_modules (
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.addon_modules(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB NOT NULL DEFAULT '{}',
    installed_by TEXT,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (server_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_server_addon_modules_server
    ON public.server_addon_modules(server_id);

CREATE INDEX IF NOT EXISTS idx_server_addon_modules_module
    ON public.server_addon_modules(module_id);

CREATE TABLE IF NOT EXISTS public.server_custom_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '1.0.0',
    source_code TEXT NOT NULL,
    source_checksum TEXT NOT NULL,
    config_schema JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'NEEDS_REUPLOAD')),
    review_results JSONB NOT NULL DEFAULT '[]',
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_server_custom_modules_server
    ON public.server_custom_modules(server_id);

CREATE OR REPLACE FUNCTION public.enforce_server_custom_module_limit()
RETURNS TRIGGER AS $$
DECLARE
    custom_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO custom_count
    FROM public.server_custom_modules
    WHERE server_id = NEW.server_id
      AND id <> NEW.id;

    IF custom_count >= 20 THEN
        RAISE EXCEPTION 'Servers can only have 20 custom modules uploaded at one time.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_server_custom_module_limit
    ON public.server_custom_modules;

CREATE TRIGGER enforce_server_custom_module_limit
    BEFORE INSERT OR UPDATE OF server_id
    ON public.server_custom_modules
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_server_custom_module_limit();

CREATE OR REPLACE FUNCTION public.enforce_server_addon_module_limit()
RETURNS TRIGGER AS $$
DECLARE
    installed_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO installed_count
    FROM public.server_addon_modules
    WHERE server_id = NEW.server_id
      AND module_id <> NEW.module_id;

    IF installed_count >= 5 THEN
        RAISE EXCEPTION 'Servers can only have 5 custom modules installed at one time.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_server_addon_module_limit
    ON public.server_addon_modules;

CREATE TRIGGER enforce_server_addon_module_limit
    BEFORE INSERT OR UPDATE OF server_id, module_id
    ON public.server_addon_modules
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_server_addon_module_limit();

UPDATE public.addon_modules
SET
    source_code = '',
    source_checksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    config_schema = '{}'::jsonb,
    updated_at = NOW()
WHERE status = 'REJECTED'
  AND (source_code <> '' OR config_schema <> '{}'::jsonb);

DELETE FROM public.server_addon_modules sam
USING public.addon_modules module
WHERE sam.module_id = module.id
  AND module.status = 'REJECTED';

UPDATE public.management_roles
SET permissions = ARRAY(
    SELECT DISTINCT permission
    FROM unnest(COALESCE(permissions, ARRAY[]::TEXT[]) || ARRAY['MANAGE_MODULES']) AS permission
)
WHERE name = 'Super Admin';
