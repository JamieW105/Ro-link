-- Create the reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    reporter_discord_id TEXT NOT NULL,
    reporter_roblox_username TEXT,
    reported_roblox_username TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    moderator_id TEXT, -- ID of the discord user moderator who acted on it
    moderator_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Add settings columns to servers table if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'reports_enabled') THEN
        ALTER TABLE public.servers ADD COLUMN reports_enabled BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'reports_channel_id') THEN
        ALTER TABLE public.servers ADD COLUMN reports_channel_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'moderator_role_id') THEN
        ALTER TABLE public.servers ADD COLUMN moderator_role_id TEXT;
    END IF;
END $$;
