-- Create Dashboard Roles Table for RBAC
CREATE TABLE IF NOT EXISTS public.dashboard_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    discord_role_id TEXT NOT NULL,
    role_name TEXT, -- Optional, can fetch live or store snapshot
    
    -- Permissions
    can_access_dashboard BOOLEAN DEFAULT FALSE,
    can_kick BOOLEAN DEFAULT FALSE,
    can_ban BOOLEAN DEFAULT FALSE,
    can_timeout BOOLEAN DEFAULT FALSE,
    can_mute BOOLEAN DEFAULT FALSE,
    can_lookup BOOLEAN DEFAULT FALSE,
    can_manage_settings BOOLEAN DEFAULT FALSE,
    can_manage_reports BOOLEAN DEFAULT FALSE,
    
    -- Misc Commands (Flexible)
    allowed_misc_cmds TEXT[] DEFAULT '{}', -- e.g. ['fly', 'heal'] or ['*'] for all
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(server_id, discord_role_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_roles_server ON public.dashboard_roles(server_id);
