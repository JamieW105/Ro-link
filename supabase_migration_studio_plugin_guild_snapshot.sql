-- Run in Supabase SQL editor (or migrate) so /api/plugin/servers can use a cached guild list.
ALTER TABLE public.studio_plugin_sessions
    ADD COLUMN IF NOT EXISTS guild_snapshot jsonb;
