-- Match the API's 2,000-character limit while retaining historical empty reviews.
ALTER TABLE public.addon_module_reviews
    DROP CONSTRAINT IF EXISTS addon_module_reviews_comment_check;
ALTER TABLE public.addon_module_reviews
    ADD CONSTRAINT addon_module_reviews_comment_check CHECK (char_length(comment) <= 2000);
-- Accept missing avatars from older API builds; new writes use empty text.
ALTER TABLE public.addon_module_reviews ALTER COLUMN reviewer_avatar_url DROP NOT NULL;
ALTER TABLE public.addon_module_reviews ALTER COLUMN reviewer_avatar_url SET DEFAULT '';
NOTIFY pgrst, 'reload schema';
