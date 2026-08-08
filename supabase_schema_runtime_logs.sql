-- Structured runtime diagnostics reported by the active Roblox Ro-Link Admin package.
CREATE TABLE IF NOT EXISTS public.runtime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL,
    place_id TEXT,
    universe_id TEXT,
    source TEXT NOT NULL CHECK (source IN ('server', 'client')),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    event_type TEXT NOT NULL,
    roblox_user_id TEXT,
    roblox_username TEXT,
    display_name TEXT,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_logs_server_job_created_idx
    ON public.runtime_logs (server_id, job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS runtime_logs_server_job_player_created_idx
    ON public.runtime_logs (server_id, job_id, roblox_user_id, created_at DESC);
