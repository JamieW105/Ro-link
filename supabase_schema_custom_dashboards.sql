CREATE TABLE IF NOT EXISTS public.custom_dashboard_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id TEXT NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    subdomain TEXT NOT NULL UNIQUE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_dashboard_domains_server_id_idx
ON public.custom_dashboard_domains(server_id);

