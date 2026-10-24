-- Pause/stop choices survive heartbeats until staff resume or leave the game.
ALTER TABLE public.staff_shifts ADD COLUMN shift_group_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE TABLE public.staff_shift_controls (
    server_id text NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    discord_id text NOT NULL,
    roblox_user_id text NOT NULL,
    job_id text NOT NULL,
    state text NOT NULL CHECK (state IN ('break', 'stopped')),
    shift_group_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, roblox_user_id)
);
CREATE INDEX staff_shift_controls_discord_idx ON public.staff_shift_controls(server_id, discord_id);
ALTER TABLE public.staff_shift_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_shift_controls FROM anon, authenticated;
GRANT ALL ON public.staff_shift_controls TO service_role;

CREATE OR REPLACE FUNCTION public.staff_shift_prepare(p_server text) RETURNS public.staff_shift_waves
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    config public.staff_shift_settings;
    wave public.staff_shift_waves;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('staff-shifts:' || p_server, 0));
    INSERT INTO public.staff_shift_settings(server_id) VALUES (p_server) ON CONFLICT DO NOTHING;
    SELECT * INTO config FROM public.staff_shift_settings WHERE server_id = p_server;
    UPDATE public.staff_shifts SET ended_at = last_seen_at
      WHERE server_id = p_server AND ended_at IS NULL AND last_seen_at < now() - interval '2 minutes';
    DELETE FROM public.staff_shift_controls WHERE server_id = p_server AND last_seen_at < now() - interval '2 minutes';
    SELECT * INTO wave FROM public.staff_shift_waves WHERE server_id = p_server ORDER BY starts_at DESC LIMIT 1;
    IF wave.id IS NULL THEN
        INSERT INTO public.staff_shift_waves(server_id, starts_at, ends_at, quota_hours)
        VALUES (p_server, now(), now() + make_interval(days => config.wave_days), config.quota_hours) RETURNING * INTO wave;
    END IF;
    WHILE wave.ends_at <= now() LOOP
        INSERT INTO public.staff_shift_waves(server_id, starts_at, ends_at, quota_hours)
        VALUES (p_server, wave.ends_at, wave.ends_at + make_interval(days => config.wave_days), config.quota_hours) RETURNING * INTO wave;
    END LOOP;
    RETURN wave;
END $$;

CREATE OR REPLACE FUNCTION public.staff_shift_sync(p_server text, p_job text, p_staff jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE config public.staff_shift_settings;
BEGIN
    PERFORM public.staff_shift_prepare(p_server);
    SELECT * INTO config FROM public.staff_shift_settings WHERE server_id = p_server;
    UPDATE public.staff_shifts SET ended_at = now()
      WHERE server_id = p_server AND job_id = p_job AND ended_at IS NULL
      AND (NOT config.enabled OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_staff) person WHERE person->>'roblox_user_id' = roblox_user_id
      ));
    DELETE FROM public.staff_shift_controls c WHERE c.server_id = p_server AND c.job_id = p_job
      AND (NOT config.enabled OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_staff) person WHERE person->>'roblox_user_id' = c.roblox_user_id));
    IF NOT config.enabled THEN RETURN; END IF;
    UPDATE public.staff_shift_controls SET last_seen_at = now() WHERE server_id = p_server AND job_id = p_job;
    UPDATE public.staff_shifts SET last_seen_at = now()
      WHERE server_id = p_server AND job_id = p_job AND ended_at IS NULL;
    IF config.automatic_start THEN
        INSERT INTO public.staff_shifts(server_id, job_id, discord_id, roblox_user_id, username)
        SELECT p_server, p_job, person->>'discord_id', person->>'roblox_user_id', person->>'username'
        FROM jsonb_array_elements(p_staff) person
        WHERE NOT EXISTS (SELECT 1 FROM public.staff_shift_controls c WHERE c.server_id = p_server AND c.roblox_user_id = person->>'roblox_user_id')
        ON CONFLICT (server_id, job_id, roblox_user_id) WHERE ended_at IS NULL DO NOTHING;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.staff_shift_configure(p_server text, p_enabled boolean, p_automatic boolean, p_days integer, p_quota numeric) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE wave public.staff_shift_waves; previously_enabled boolean;
BEGIN
    -- Finish expired waves using the old settings before saving next-wave values.
    wave := public.staff_shift_prepare(p_server);
    SELECT enabled INTO previously_enabled FROM public.staff_shift_settings WHERE server_id = p_server;
    UPDATE public.staff_shift_settings SET enabled = p_enabled, automatic_start = p_automatic,
      wave_days = p_days, quota_hours = p_quota WHERE server_id = p_server;
    -- The first enabled wave starts with the owner's chosen length and quota.
    IF p_enabled AND NOT previously_enabled AND NOT EXISTS (SELECT 1 FROM public.staff_shifts WHERE server_id = p_server) THEN
        UPDATE public.staff_shift_waves SET starts_at = now(), ends_at = now() + make_interval(days => p_days), quota_hours = p_quota
          WHERE id = wave.id;
    END IF;
    IF NOT p_enabled THEN
        DELETE FROM public.staff_shift_controls WHERE server_id = p_server;
        UPDATE public.staff_shifts SET ended_at = now() WHERE server_id = p_server AND ended_at IS NULL;
    END IF;
END $$;

-- Both transports resolve the actor's linked account and game roster first.
CREATE FUNCTION public.staff_shift_action(p_server text, p_job text, p_discord text, p_roblox text, p_username text, p_action text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE config public.staff_shift_settings; current_shift public.staff_shifts; control public.staff_shift_controls; group_id uuid; target_job text;
BEGIN
    PERFORM public.staff_shift_prepare(p_server);
    SELECT * INTO config FROM public.staff_shift_settings WHERE server_id = p_server;
    IF NOT config.enabled THEN RAISE EXCEPTION 'Staff shifts are disabled'; END IF;
    IF p_action NOT IN ('start', 'stop', 'break') THEN RAISE EXCEPTION 'Invalid shift action'; END IF;
    SELECT * INTO current_shift FROM public.staff_shifts WHERE server_id = p_server AND discord_id = p_discord AND roblox_user_id = p_roblox AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
    SELECT * INTO control FROM public.staff_shift_controls WHERE server_id = p_server AND discord_id = p_discord AND roblox_user_id = p_roblox;
    IF p_action = 'start' THEN
        IF p_job = '' THEN RAISE EXCEPTION 'Join the linked game before starting a shift'; END IF;
        IF current_shift.id IS NOT NULL THEN RETURN; END IF;
        group_id := CASE WHEN control.state = 'break' THEN control.shift_group_id ELSE NULL END;
        DELETE FROM public.staff_shift_controls WHERE server_id = p_server AND roblox_user_id = p_roblox;
        INSERT INTO public.staff_shifts(server_id, job_id, discord_id, roblox_user_id, username, shift_group_id)
        VALUES (p_server, p_job, p_discord, p_roblox, p_username, coalesce(group_id, gen_random_uuid()));
    ELSE
        IF p_action = 'break' AND current_shift.id IS NULL THEN RAISE EXCEPTION 'Start a shift before taking a break'; END IF;
        IF current_shift.id IS NULL AND control.state IS DISTINCT FROM 'break' THEN RAISE EXCEPTION 'You are not currently on shift'; END IF;
        UPDATE public.staff_shifts SET ended_at = now() WHERE server_id = p_server AND discord_id = p_discord AND roblox_user_id = p_roblox AND ended_at IS NULL;
        target_job := coalesce(nullif(p_job, ''), current_shift.job_id, control.job_id);
        INSERT INTO public.staff_shift_controls(server_id, discord_id, roblox_user_id, job_id, state, shift_group_id)
        VALUES (p_server, p_discord, p_roblox, target_job, CASE WHEN p_action = 'break' THEN 'break' ELSE 'stopped' END, CASE WHEN p_action = 'break' THEN current_shift.shift_group_id ELSE NULL END)
        ON CONFLICT (server_id, roblox_user_id) DO UPDATE SET discord_id = excluded.discord_id, job_id = excluded.job_id,
            state = excluded.state, shift_group_id = excluded.shift_group_id, updated_at = now(), last_seen_at = now();
    END IF;
END $$;

-- Preserve the dashboard manual-mode contract while sharing pause/resume state.
CREATE OR REPLACE FUNCTION public.staff_shift_manual(p_server text, p_job text, p_discord text, p_roblox text, p_username text, p_start boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE config public.staff_shift_settings;
BEGIN
    PERFORM public.staff_shift_prepare(p_server);
    SELECT * INTO config FROM public.staff_shift_settings WHERE server_id = p_server;
    IF NOT config.enabled OR config.automatic_start THEN
        RAISE EXCEPTION 'Manual shifts require enabled shifts with automatic start turned off';
    END IF;
    PERFORM public.staff_shift_action(p_server, p_job, p_discord, p_roblox, p_username, CASE WHEN p_start THEN 'start' ELSE 'stop' END);
END $$;

CREATE OR REPLACE FUNCTION public.staff_shift_report(p_server text, p_discord text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE wave public.staff_shift_waves; report_start timestamptz; result jsonb;
BEGIN
    wave := public.staff_shift_prepare(p_server);
    report_start := coalesce(p_from, wave.starts_at);
    SELECT jsonb_build_object(
        'settings', (SELECT to_jsonb(s) - 'server_id' FROM public.staff_shift_settings s WHERE s.server_id = p_server),
        'wave', to_jsonb(wave) - 'server_id',
        'current_shift_seconds', (SELECT coalesce(sum(extract(epoch FROM coalesce(s.ended_at, s.last_seen_at) - s.started_at)), 0)
            FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = p_discord AND s.shift_group_id = coalesce(
                (SELECT shift_group_id FROM public.staff_shifts WHERE server_id = p_server AND discord_id = p_discord AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1),
                (SELECT shift_group_id FROM public.staff_shift_controls WHERE server_id = p_server AND discord_id = p_discord AND state = 'break' LIMIT 1))),
        'control', (SELECT jsonb_build_object('state', state, 'since', updated_at) FROM public.staff_shift_controls WHERE server_id = p_server AND discord_id = p_discord LIMIT 1),
        'staff', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'discord_id', person.discord_id, 'roblox_user_id', person.roblox_user_id, 'username', person.username,
                'seconds', public.staff_shift_seconds(p_server, person.discord_id, report_start, now()),
                'wave_seconds', public.staff_shift_seconds(p_server, person.discord_id, wave.starts_at, wave.ends_at),
                'total_seconds', public.staff_shift_seconds(p_server, person.discord_id, '-infinity', now()),
                'shift_count', (SELECT count(DISTINCT shift_group_id) FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = person.discord_id AND s.started_at < now() AND coalesce(s.ended_at, s.last_seen_at) >= report_start),
                'total_shifts', (SELECT count(DISTINCT shift_group_id) FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = person.discord_id),
                'on_break', EXISTS (SELECT 1 FROM public.staff_shift_controls c WHERE c.server_id = p_server AND c.discord_id = person.discord_id AND c.state = 'break'),
                'active', EXISTS (SELECT 1 FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = person.discord_id AND s.ended_at IS NULL)
            ) ORDER BY person.username)
            FROM (
                SELECT DISTINCT ON (discord_id) discord_id, roblox_user_id, username FROM public.staff_shifts
                WHERE server_id = p_server AND (p_discord IS NULL OR discord_id = p_discord)
                ORDER BY discord_id, started_at DESC
            ) person
        ), '[]'::jsonb),
        'shifts', coalesce((
            SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent.started_at DESC, recent.id)
            FROM (
                SELECT id, discord_id, username, started_at, ended_at, last_seen_at,
                    greatest(0, extract(epoch FROM least(coalesce(ended_at, last_seen_at), now()) - greatest(started_at, report_start))) seconds,
                    ended_at IS NULL active
                FROM public.staff_shifts WHERE server_id = p_server AND (p_discord IS NULL OR discord_id = p_discord)
                AND coalesce(ended_at, last_seen_at) >= report_start
                ORDER BY started_at DESC, id LIMIT 50 OFFSET greatest(0, p_offset)
            ) recent
        ), '[]'::jsonb),
        'has_more', (SELECT count(*) > greatest(0, p_offset) + 50 FROM public.staff_shifts
            WHERE server_id = p_server AND (p_discord IS NULL OR discord_id = p_discord) AND coalesce(ended_at, last_seen_at) >= report_start)
    ) INTO result;
    RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.staff_shift_action(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_shift_action(text,text,text,text,text,text) TO service_role;
