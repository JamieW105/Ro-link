ALTER TABLE public.addon_modules ADD COLUMN IF NOT EXISTS cover_images text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.addon_modules ADD CONSTRAINT addon_modules_cover_image_count CHECK (cardinality(cover_images) <= 4 AND array_position(cover_images, NULL) IS NULL);
CREATE TABLE public.addon_module_cover_uploads (
    path text PRIMARY KEY,
    owner_discord_id text NOT NULL,
    size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addon_module_cover_upload_owner_idx ON public.addon_module_cover_uploads(owner_discord_id);
ALTER TABLE public.addon_module_cover_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.addon_module_cover_uploads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.addon_module_cover_uploads TO service_role;
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('module-covers', 'module-covers', false, 2097152, ARRAY['image/webp'])
ON CONFLICT(id) DO UPDATE SET public = false, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/webp'];
NOTIFY pgrst, 'reload schema';
