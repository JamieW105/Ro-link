CREATE TABLE IF NOT EXISTS public.staff_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    target_discord_id TEXT,
    target_roblox_id TEXT,
    target_roblox_username TEXT,
    target_roblox_username_lower TEXT,
    note TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1500),
    created_by_discord_id TEXT,
    created_by_tag TEXT NOT NULL DEFAULT 'Unknown Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff_notes
    ADD COLUMN IF NOT EXISTS target_discord_id TEXT,
    ADD COLUMN IF NOT EXISTS target_roblox_id TEXT,
    ADD COLUMN IF NOT EXISTS target_roblox_username TEXT,
    ADD COLUMN IF NOT EXISTS target_roblox_username_lower TEXT,
    ADD COLUMN IF NOT EXISTS created_by_discord_id TEXT,
    ADD COLUMN IF NOT EXISTS created_by_tag TEXT NOT NULL DEFAULT 'Unknown Staff',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.staff_notes
SET target_roblox_username_lower = lower(target_roblox_username)
WHERE target_roblox_username IS NOT NULL
    AND (target_roblox_username_lower IS NULL OR target_roblox_username_lower = '');

CREATE INDEX IF NOT EXISTS idx_staff_notes_server_created
    ON public.staff_notes(server_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_notes_discord
    ON public.staff_notes(server_id, target_discord_id)
    WHERE target_discord_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_notes_roblox_id
    ON public.staff_notes(server_id, target_roblox_id)
    WHERE target_roblox_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_notes_roblox_username
    ON public.staff_notes(server_id, target_roblox_username_lower)
    WHERE target_roblox_username_lower IS NOT NULL;
