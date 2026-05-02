-- Add-on Module Marketplace
CREATE TABLE IF NOT EXISTS public.addon_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '1.0.0',
    category TEXT NOT NULL DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    source_code TEXT NOT NULL,
    source_checksum TEXT NOT NULL,
    author_discord_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_addon_modules_status
    ON public.addon_modules(status);

CREATE INDEX IF NOT EXISTS idx_addon_modules_category
    ON public.addon_modules(category);

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

UPDATE public.management_roles
SET permissions = ARRAY(
    SELECT DISTINCT permission
    FROM unnest(COALESCE(permissions, ARRAY[]::TEXT[]) || ARRAY['MANAGE_MODULES']) AS permission
)
WHERE name = 'Super Admin';
