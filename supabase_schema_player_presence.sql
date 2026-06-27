-- Retains the most recent live player joins and leaves for dashboard targeting.
CREATE TABLE IF NOT EXISTS public.player_presence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL,
    roblox_user_id TEXT,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('JOIN', 'LEAVE')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_presence_events_server_occurred_idx
    ON public.player_presence_events (server_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS player_presence_events_server_user_occurred_idx
    ON public.player_presence_events (server_id, roblox_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS player_presence_events_server_username_occurred_idx
    ON public.player_presence_events (server_id, username, occurred_at DESC);
