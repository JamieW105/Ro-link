-- Historical reports must use the completed wave's bounds and quota snapshot.
-- Keep the existing report signature unchanged for personal and Discord reports.
CREATE FUNCTION public.staff_shift_previous_wave_report(
    p_server text, p_discord text DEFAULT NULL, p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    current_wave public.staff_shift_waves;
    wave public.staff_shift_waves;
    result jsonb;
BEGIN
    current_wave := public.staff_shift_prepare(p_server);
    SELECT * INTO wave FROM public.staff_shift_waves
    WHERE server_id = p_server AND ends_at <= current_wave.starts_at
    ORDER BY ends_at DESC, starts_at DESC LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'settings', (SELECT to_jsonb(s) - 'server_id' FROM public.staff_shift_settings s WHERE s.server_id = p_server),
            'wave', NULL, 'staff', '[]'::jsonb, 'shifts', '[]'::jsonb, 'has_more', false,
            'current_shift_seconds', 0, 'control', NULL
        );
    END IF;

    WITH wave_shifts AS MATERIALIZED (
        SELECT id, discord_id, roblox_user_id, username, shift_group_id,
            greatest(started_at, wave.starts_at) started_at,
            least(coalesce(ended_at, last_seen_at), wave.ends_at) ended_at
        FROM public.staff_shifts
        WHERE server_id = p_server AND (p_discord IS NULL OR discord_id = p_discord)
            AND started_at < wave.ends_at AND coalesce(ended_at, last_seen_at) > wave.starts_at
    )
    SELECT jsonb_build_object(
        'settings', (SELECT to_jsonb(s) - 'server_id' FROM public.staff_shift_settings s WHERE s.server_id = p_server),
        'wave', to_jsonb(wave) - 'server_id', 'current_shift_seconds', 0, 'control', NULL,
        'staff', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'discord_id', person.discord_id, 'roblox_user_id', person.roblox_user_id, 'username', person.username,
                'seconds', public.staff_shift_seconds(p_server, person.discord_id, wave.starts_at, wave.ends_at),
                'wave_seconds', public.staff_shift_seconds(p_server, person.discord_id, wave.starts_at, wave.ends_at),
                'total_seconds', public.staff_shift_seconds(p_server, person.discord_id, '-infinity', wave.ends_at),
                'shift_count', (SELECT count(DISTINCT shift_group_id) FROM wave_shifts s WHERE s.discord_id = person.discord_id),
                'total_shifts', (SELECT count(DISTINCT shift_group_id) FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = person.discord_id AND s.started_at < wave.ends_at),
                'active', false, 'on_break', false
            ) ORDER BY person.username)
            FROM (SELECT DISTINCT ON (discord_id) discord_id, roblox_user_id, username
                FROM wave_shifts ORDER BY discord_id, started_at DESC, id) person
        ), '[]'::jsonb),
        'shifts', coalesce((
            SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent.started_at DESC, recent.id)
            FROM (SELECT id, discord_id, username, started_at, ended_at, ended_at last_seen_at,
                    extract(epoch FROM ended_at - started_at) seconds, false active
                FROM wave_shifts ORDER BY started_at DESC, id LIMIT 50 OFFSET greatest(0, p_offset)) recent
        ), '[]'::jsonb),
        'has_more', (SELECT count(*) > greatest(0, p_offset) + 50 FROM wave_shifts)
    ) INTO result;
    RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.staff_shift_previous_wave_report(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_shift_previous_wave_report(text, text, integer) TO service_role;
