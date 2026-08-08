CREATE TABLE IF NOT EXISTS public.public_page_content (
    page TEXT PRIMARY KEY CHECK (page IN ('pricing', 'features')),
    content JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.public_page_content ENABLE ROW LEVEL SECURITY;

-- Public pages and management APIs use the server-side service role. No client policies are required.
