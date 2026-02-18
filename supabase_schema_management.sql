-- Management Roles (Global)
CREATE TABLE IF NOT EXISTS public.management_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    permissions TEXT[] DEFAULT '{}', -- ['RO_LINK_DASHBOARD', 'MANAGE_SERVERS', 'POST_JOB_APPLICATION', 'BLOCK_SERVERS', 'MANAGE_RO_LINK']
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Management Users (Global)
CREATE TABLE IF NOT EXISTS public.management_users (
    discord_id TEXT PRIMARY KEY,
    role_id UUID REFERENCES public.management_roles(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked Servers
CREATE TABLE IF NOT EXISTS public.blocked_servers (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT,
    owner_id TEXT,
    reason TEXT NOT NULL,
    blocked_by TEXT NOT NULL, -- discord_id
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Applications
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    requirements TEXT,
    tags TEXT[] DEFAULT '{}', -- ['Developer', 'Support', 'Moderation', 'Marketing']
    status TEXT DEFAULT 'CLOSED', -- 'OPEN', 'CLOSED'
    questions JSONB DEFAULT '[]', -- List of questions with types: multi-choice, short-answer, long-answer, checkbox, section
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Submissions
CREATE TABLE IF NOT EXISTS public.job_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    answers JSONB NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'DENIED'
    review_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(application_id, discord_id) -- Only 1 submission per application per user
);

-- Insert initial Admin role for cherubdude
INSERT INTO public.management_roles (name, permissions)
VALUES ('Super Admin', ARRAY['RO_LINK_DASHBOARD', 'MANAGE_SERVERS', 'POST_JOB_APPLICATION', 'BLOCK_SERVERS', 'MANAGE_RO_LINK'])
ON CONFLICT (name) DO NOTHING;

-- Assign cherubdude to the initial role (id will be fetched or we can use a subquery)
INSERT INTO public.management_users (discord_id, role_id)
SELECT '953414442060746854', id FROM public.management_roles WHERE name = 'Super Admin'
ON CONFLICT (discord_id) DO UPDATE SET role_id = EXCLUDED.role_id;
