CREATE TABLE IF NOT EXISTS public.studio_plugin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    discord_user_id TEXT,
    discord_username TEXT,
    discord_access_token TEXT,
    plugin_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    authorized_at TIMESTAMPTZ,
    token_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_studio_plugin_sessions_expires_at
    ON public.studio_plugin_sessions(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_plugin_sessions_plugin_token
    ON public.studio_plugin_sessions(plugin_token)
    WHERE plugin_token IS NOT NULL;
