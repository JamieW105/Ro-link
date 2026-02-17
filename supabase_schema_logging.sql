-- Add logging_channel_id to servers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'logging_channel_id') THEN
        ALTER TABLE public.servers ADD COLUMN logging_channel_id TEXT;
    END IF;
END $$;
