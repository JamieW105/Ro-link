CREATE TABLE IF NOT EXISTS public.site_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
    placement TEXT NOT NULL DEFAULT 'ALL' CHECK (placement IN ('PUBLIC', 'DASHBOARD', 'ALL')),
    tone TEXT NOT NULL DEFAULT 'INFO' CHECK (tone IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
    link_label TEXT,
    link_url TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT site_banners_schedule_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CONSTRAINT site_banners_link_pair_check CHECK ((link_label IS NULL) = (link_url IS NULL))
);

CREATE INDEX IF NOT EXISTS site_banners_active_idx
    ON public.site_banners(enabled, created_at DESC);
