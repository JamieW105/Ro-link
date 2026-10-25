-- Preserve reviews from both the existing marketplace schema and the initial PR schema.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'addon_module_reviews' AND column_name = 'author_discord_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'addon_module_reviews' AND column_name = 'reviewer_discord_id') THEN
        ALTER TABLE public.addon_module_reviews RENAME COLUMN author_discord_id TO reviewer_discord_id;
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.addon_module_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id uuid NOT NULL REFERENCES public.addon_modules(id) ON DELETE CASCADE,
    reviewer_discord_id text NOT NULL,
    reviewer_name text NOT NULL CHECK (char_length(btrim(reviewer_name)) BETWEEN 1 AND 100),
    reviewer_avatar_url text,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (module_id, reviewer_discord_id)
);
CREATE INDEX IF NOT EXISTS addon_module_reviews_page_idx ON public.addon_module_reviews(module_id, created_at DESC, id DESC);
ALTER TABLE public.addon_module_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.addon_module_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addon_module_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.module_review_summary(p_module uuid, p_discord text, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'total', (SELECT count(*) FROM public.addon_module_reviews WHERE module_id = p_module),
        'average', (SELECT coalesce(round(avg(rating), 1), 0) FROM public.addon_module_reviews WHERE module_id = p_module),
        'reviews', coalesce((
            SELECT jsonb_agg(item ORDER BY created_at DESC, id DESC) FROM (
                SELECT id, created_at, jsonb_build_object(
                    'id', id, 'rating', rating, 'comment', comment,
                    'name', reviewer_name, 'avatarUrl', reviewer_avatar_url,
                    'createdAt', created_at, 'updatedAt', updated_at,
                    'isOwn', reviewer_discord_id = p_discord
                ) AS item
                FROM public.addon_module_reviews WHERE module_id = p_module
                ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET greatest(p_offset, 0)
            ) AS page
        ), '[]'::jsonb),
        'ownReview', (SELECT jsonb_build_object('id', id, 'rating', rating, 'comment', comment) FROM public.addon_module_reviews WHERE module_id = p_module AND reviewer_discord_id = p_discord),
        'hasMore', (SELECT count(*) > greatest(p_offset, 0) + 10 FROM public.addon_module_reviews WHERE module_id = p_module)
    );
$$;
REVOKE ALL ON FUNCTION public.module_review_summary(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.module_review_summary(uuid, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
