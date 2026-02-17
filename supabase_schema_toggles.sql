DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'admin_cmds_enabled') THEN
        ALTER TABLE public.servers ADD COLUMN admin_cmds_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'misc_cmds_enabled') THEN
        ALTER TABLE public.servers ADD COLUMN misc_cmds_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
