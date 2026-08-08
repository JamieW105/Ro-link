CREATE TABLE IF NOT EXISTS public.moderation_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appellant_discord_id TEXT NOT NULL,
    appellant_discord_name TEXT,
    appellant_roblox_id TEXT NOT NULL,
    appellant_roblox_username TEXT,
    moderation_source TEXT NOT NULL CHECK (moderation_source IN ('DGSU_BAN', 'STAFF_ACTION')),
    moderation_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('ROBLOX_USER', 'DISCORD_USER', 'DISCORD_SERVER', 'ROBLOX_GAME')),
    target_id TEXT NOT NULL,
    original_forum_url TEXT,
    original_reason TEXT,
    appeal_reason TEXT NOT NULL CHECK (char_length(appeal_reason) BETWEEN 20 AND 2000),
    evidence_links TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWING', 'ACCEPTED', 'DENIED', 'CLOSED')),
    discord_thread_id TEXT,
    discord_thread_url TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_appeals_appellant_idx
    ON public.moderation_appeals(appellant_discord_id, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_appeals_moderation_idx
    ON public.moderation_appeals(moderation_source, moderation_id);

CREATE INDEX IF NOT EXISTS moderation_appeals_status_idx
    ON public.moderation_appeals(status, created_at DESC);
