CREATE TABLE IF NOT EXISTS public.public_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_discord_id TEXT NOT NULL,
    reporter_discord_tag TEXT,
    reporter_roblox_id TEXT,
    reporter_roblox_username TEXT,
    target_type TEXT NOT NULL CHECK (target_type IN ('ROBLOX_USER', 'DISCORD_USER', 'DISCORD_SERVER', 'ROBLOX_GAME')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 15 AND 2000),
    evidence_links TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
    moderation_action TEXT,
    moderation_reason TEXT,
    moderated_by TEXT,
    moderated_at TIMESTAMPTZ,
    discord_thread_id TEXT,
    discord_thread_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.public_reports
    ADD COLUMN IF NOT EXISTS reporter_discord_tag TEXT,
    ADD COLUMN IF NOT EXISTS reporter_roblox_id TEXT,
    ADD COLUMN IF NOT EXISTS reporter_roblox_username TEXT,
    ADD COLUMN IF NOT EXISTS evidence_links TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN',
    ADD COLUMN IF NOT EXISTS moderation_action TEXT,
    ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
    ADD COLUMN IF NOT EXISTS moderated_by TEXT,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS discord_thread_id TEXT,
    ADD COLUMN IF NOT EXISTS discord_thread_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS public_reports_reporter_created_idx
    ON public.public_reports(reporter_discord_id, created_at DESC);

CREATE INDEX IF NOT EXISTS public_reports_target_idx
    ON public.public_reports(target_type, target_id);

CREATE INDEX IF NOT EXISTS public_reports_status_created_idx
    ON public.public_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dgsu_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL CHECK (target_type IN ('ROBLOX_USER', 'DISCORD_USER', 'DISCORD_SERVER', 'ROBLOX_GAME')),
    target_id TEXT NOT NULL,
    reason TEXT,
    source_public_report_id UUID REFERENCES public.public_reports(id) ON DELETE SET NULL,
    banned_by TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dgsu_bans_target_unique UNIQUE(target_type, target_id)
);

ALTER TABLE public.dgsu_bans
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS source_public_report_id UUID REFERENCES public.public_reports(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS banned_by TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS dgsu_bans_target_idx
    ON public.dgsu_bans(target_type, target_id);

CREATE INDEX IF NOT EXISTS dgsu_bans_public_report_idx
    ON public.dgsu_bans(source_public_report_id)
    WHERE source_public_report_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'dgsu_bans_target_unique'
            AND conrelid = 'public.dgsu_bans'::regclass
    ) THEN
        ALTER TABLE public.dgsu_bans
        ADD CONSTRAINT dgsu_bans_target_unique UNIQUE(target_type, target_id);
    END IF;
END $$;
