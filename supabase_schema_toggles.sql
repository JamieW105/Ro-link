DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'admin_cmds_enabled') THEN
        ALTER TABLE public.servers ADD COLUMN admin_cmds_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'misc_cmds_enabled') THEN
        ALTER TABLE public.servers ADD COLUMN misc_cmds_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'enforce_moderation_role_hierarchy') THEN
        ALTER TABLE public.servers ADD COLUMN enforce_moderation_role_hierarchy BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

UPDATE public.servers
SET enforce_moderation_role_hierarchy = TRUE
WHERE enforce_moderation_role_hierarchy IS NULL;
