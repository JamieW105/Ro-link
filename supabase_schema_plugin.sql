-- Plugin Sessions Table
CREATE TABLE IF NOT EXISTS public.plugin_sessions (
    session_id UUID PRIMARY KEY,
    studio_user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    token TEXT, -- Generated JWT or secure token after approval
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games Configuration Table
CREATE TABLE IF NOT EXISTS public.games_configuration (
    game_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL, -- Discord ID or Studio User ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
