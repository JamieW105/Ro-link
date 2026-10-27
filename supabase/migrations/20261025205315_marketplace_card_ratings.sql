-- Only aggregate visible catalog IDs supplied by the authenticated server route.
CREATE OR REPLACE FUNCTION public.module_catalog_ratings(p_modules uuid[])
RETURNS TABLE(module_id uuid, average numeric, total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT module_id, round(avg(rating), 1), count(*)
    FROM public.addon_module_reviews
    WHERE module_id = ANY(p_modules)
    GROUP BY module_id;
$$;
REVOKE ALL ON FUNCTION public.module_catalog_ratings(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.module_catalog_ratings(uuid[]) TO service_role;
NOTIFY pgrst, 'reload schema';
