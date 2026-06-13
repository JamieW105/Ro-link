-- Management Roles (Global)
CREATE TABLE IF NOT EXISTS public.management_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    permissions TEXT[] DEFAULT '{}', -- ['RO_LINK_DASHBOARD', 'MANAGE_SERVERS', 'POST_JOB_APPLICATION', 'POST_UPDATES', 'BLOCK_SERVERS', 'MANAGE_MODULES', 'MANAGE_RO_LINK']
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Management Users (Global)
CREATE TABLE IF NOT EXISTS public.management_users (
    discord_id TEXT PRIMARY KEY,
    role_id UUID REFERENCES public.management_roles(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Management Dashboard DM Opt-Outs
CREATE TABLE IF NOT EXISTS public.management_dm_opt_outs (
    discord_id TEXT PRIMARY KEY,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Staff Moderation Actions
CREATE TABLE IF NOT EXISTS public.staff_moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (action_type IN ('removed', 'blocked')),
    guild_id TEXT NOT NULL,
    guild_name TEXT,
    owner_id TEXT,
    reason TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VOIDED')),
    voided_by TEXT,
    voided_at TIMESTAMPTZ,
    forum_thread_id TEXT
);

CREATE INDEX IF NOT EXISTS staff_moderation_actions_guild_idx
ON public.staff_moderation_actions(guild_id);

CREATE INDEX IF NOT EXISTS staff_moderation_actions_status_idx
ON public.staff_moderation_actions(status);

ALTER TABLE public.blocked_servers
ADD COLUMN IF NOT EXISTS moderation_action_id UUID REFERENCES public.staff_moderation_actions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blocked_servers_moderation_action_id_idx
ON public.blocked_servers(moderation_action_id);

DO $$
BEGIN
    IF to_regclass('public.logs') IS NOT NULL THEN
        ALTER TABLE public.logs
        ADD COLUMN IF NOT EXISTS moderation_action_id UUID REFERENCES public.staff_moderation_actions(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS logs_moderation_action_id_idx
        ON public.logs(moderation_action_id);
    END IF;
END $$;

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

-- Update Posts
CREATE TABLE IF NOT EXISTS public.update_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL DEFAULT 'V2.01.0',
    rolink_version TEXT NOT NULL DEFAULT 'V2.01.0',
    plugin_version TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    major_features JSONB NOT NULL DEFAULT '[]',
    minor_updates TEXT[] NOT NULL DEFAULT '{}',
    qol_updates TEXT[] NOT NULL DEFAULT '{}',
    bug_fixes TEXT[] NOT NULL DEFAULT '{}',
    author_discord_id TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'update_posts' AND column_name = 'version'
    ) THEN
        ALTER TABLE public.update_posts ADD COLUMN version TEXT NOT NULL DEFAULT 'V2.01.0';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'update_posts' AND column_name = 'rolink_version'
    ) THEN
        ALTER TABLE public.update_posts ADD COLUMN rolink_version TEXT NOT NULL DEFAULT 'V2.01.0';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'update_posts' AND column_name = 'plugin_version'
    ) THEN
        ALTER TABLE public.update_posts ADD COLUMN plugin_version TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'update_posts' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.update_posts ADD COLUMN status TEXT NOT NULL DEFAULT 'DRAFT';
    END IF;
END $$;

ALTER TABLE public.update_posts
ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE public.update_posts
ALTER COLUMN published_at DROP NOT NULL,
ALTER COLUMN published_at DROP DEFAULT;

UPDATE public.update_posts
SET version = 'V2.01.0'
WHERE version IS NULL OR btrim(version) = '';

UPDATE public.update_posts
SET rolink_version = version
WHERE rolink_version IS NULL OR btrim(rolink_version) = '';

UPDATE public.update_posts
SET status = 'PUBLISHED'
WHERE published_at IS NOT NULL AND status IS DISTINCT FROM 'PUBLISHED';

UPDATE public.update_posts
SET status = 'DRAFT'
WHERE published_at IS NULL AND status IS DISTINCT FROM 'DRAFT';

ALTER TABLE public.update_posts
ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'update_posts_status_check'
            AND conrelid = 'public.update_posts'::regclass
    ) THEN
        ALTER TABLE public.update_posts
        ADD CONSTRAINT update_posts_status_check CHECK (status IN ('DRAFT', 'PUBLISHED'));
    END IF;
END $$;

-- Insert initial Admin role for cherubdude
INSERT INTO public.management_roles (name, permissions)
VALUES ('Super Admin', ARRAY['RO_LINK_DASHBOARD', 'MANAGE_SERVERS', 'POST_JOB_APPLICATION', 'POST_UPDATES', 'BLOCK_SERVERS', 'MANAGE_MODULES', 'MANAGE_RO_LINK'])
ON CONFLICT (name) DO NOTHING;

UPDATE public.management_roles
SET permissions = ARRAY(
    SELECT DISTINCT permission
    FROM unnest(COALESCE(permissions, ARRAY[]::TEXT[]) || ARRAY['POST_UPDATES', 'MANAGE_MODULES']) AS permission
)
WHERE name = 'Super Admin';

-- Assign cherubdude to the initial role (id will be fetched or we can use a subquery)
INSERT INTO public.management_users (discord_id, role_id)
SELECT '953414442060746854', id FROM public.management_roles WHERE name = 'Super Admin'
ON CONFLICT (discord_id) DO UPDATE SET role_id = EXCLUDED.role_id;
