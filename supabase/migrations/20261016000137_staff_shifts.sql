-- Private data: accessed only through server-side, Discord-authorized routes.
ALTER TABLE public.dashboard_roles
    ADD COLUMN IF NOT EXISTS can_view_staff_shifts boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_manage_staff_shifts boolean NOT NULL DEFAULT false;

CREATE TABLE public.staff_shift_settings (
    server_id text PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false,
    automatic_start boolean NOT NULL DEFAULT true,
    wave_days integer NOT NULL DEFAULT 7 CHECK (wave_days BETWEEN 1 AND 366),
    quota_hours numeric NOT NULL DEFAULT 5 CHECK (quota_hours BETWEEN 0 AND 8784)
);
CREATE TABLE public.staff_shift_waves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    quota_hours numeric NOT NULL CHECK (quota_hours BETWEEN 0 AND 8784),
    CHECK (ends_at > starts_at),
    UNIQUE (server_id, starts_at)
);
CREATE TABLE public.staff_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    job_id text NOT NULL,
    discord_id text NOT NULL,
    roblox_user_id text NOT NULL,
    username text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    CHECK (last_seen_at >= started_at),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX staff_shifts_active_idx ON public.staff_shifts(server_id, job_id, roblox_user_id) WHERE ended_at IS NULL;
CREATE INDEX staff_shifts_history_idx ON public.staff_shifts(server_id, discord_id, started_at);
CREATE INDEX staff_shifts_recent_idx ON public.staff_shifts(server_id, started_at DESC);
ALTER TABLE public.staff_shift_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shift_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_shift_settings, public.staff_shift_waves, public.staff_shifts FROM anon, authenticated;
GRANT ALL ON public.staff_shift_settings, public.staff_shift_waves, public.staff_shifts TO service_role;

-- Serialize settings, wave rollover, and roster changes per linked community.
-- Expired sessions stop at the last confirmed heartbeat, never at the next visit.
CREATE FUNCTION public.staff_shift_prepare(p_server text) RETURNS public.staff_shift_waves
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

CREATE FUNCTION public.staff_shift_sync(p_server text, p_job text, p_staff jsonb) RETURNS void
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
    IF NOT config.enabled THEN RETURN; END IF;
    UPDATE public.staff_shifts SET last_seen_at = now()
      WHERE server_id = p_server AND job_id = p_job AND ended_at IS NULL;
    IF config.automatic_start THEN
        INSERT INTO public.staff_shifts(server_id, job_id, discord_id, roblox_user_id, username)
        SELECT p_server, p_job, person->>'discord_id', person->>'roblox_user_id', person->>'username'
        FROM jsonb_array_elements(p_staff) person
        ON CONFLICT (server_id, job_id, roblox_user_id) WHERE ended_at IS NULL DO NOTHING;
    END IF;
END $$;

CREATE FUNCTION public.staff_shift_configure(p_server text, p_enabled boolean, p_automatic boolean, p_days integer, p_quota numeric) RETURNS void
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
        UPDATE public.staff_shifts SET ended_at = now() WHERE server_id = p_server AND ended_at IS NULL;
    END IF;
END $$;

-- Called only after the API confirms this staff member is in a fresh game roster.
CREATE FUNCTION public.staff_shift_manual(p_server text, p_job text, p_discord text, p_roblox text, p_username text, p_start boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE config public.staff_shift_settings;
BEGIN
    PERFORM public.staff_shift_prepare(p_server);
    SELECT * INTO config FROM public.staff_shift_settings WHERE server_id = p_server;
    IF NOT config.enabled OR config.automatic_start THEN
        RAISE EXCEPTION 'Manual shifts require enabled shifts with automatic start turned off';
    END IF;
    IF p_start THEN
        INSERT INTO public.staff_shifts(server_id, job_id, discord_id, roblox_user_id, username)
        VALUES (p_server, p_job, p_discord, p_roblox, p_username)
        ON CONFLICT (server_id, job_id, roblox_user_id) WHERE ended_at IS NULL DO NOTHING;
    ELSE
        UPDATE public.staff_shifts SET ended_at = now() WHERE server_id = p_server AND discord_id = p_discord AND ended_at IS NULL;
    END IF;
END $$;

-- Merge overlapping game sessions so teleports or overlapping server heartbeats
-- cannot count the same wall-clock time twice. Clip at each reporting boundary.
CREATE FUNCTION public.staff_shift_seconds(p_server text, p_discord text, p_from timestamptz, p_to timestamptz) RETURNS numeric
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT coalesce(sum(extract(epoch FROM upper(segment) - lower(segment))), 0)
    FROM (
        SELECT unnest(range_agg(tstzrange(greatest(started_at, p_from), least(coalesce(ended_at, last_seen_at), p_to), '[)'))) segment
        FROM public.staff_shifts WHERE server_id = p_server AND discord_id = p_discord
        AND started_at < p_to AND coalesce(ended_at, last_seen_at) > p_from
        AND least(coalesce(ended_at, last_seen_at), p_to) > greatest(started_at, p_from)
    ) merged;
$$;

CREATE FUNCTION public.staff_shift_report(p_server text, p_discord text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE wave public.staff_shift_waves; report_start timestamptz; result jsonb;
BEGIN
    wave := public.staff_shift_prepare(p_server);
    report_start := coalesce(p_from, wave.starts_at);
    SELECT jsonb_build_object(
        'settings', (SELECT to_jsonb(s) - 'server_id' FROM public.staff_shift_settings s WHERE s.server_id = p_server),
        'wave', to_jsonb(wave) - 'server_id',
        'staff', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'discord_id', person.discord_id, 'roblox_user_id', person.roblox_user_id, 'username', person.username,
                'seconds', public.staff_shift_seconds(p_server, person.discord_id, report_start, now()),
                'wave_seconds', public.staff_shift_seconds(p_server, person.discord_id, wave.starts_at, wave.ends_at),
                'total_seconds', public.staff_shift_seconds(p_server, person.discord_id, '-infinity', now()),
                'shift_count', (SELECT count(*) FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = person.discord_id AND s.started_at < now() AND coalesce(s.ended_at, s.last_seen_at) >= report_start),
                'total_shifts', (SELECT count(*) FROM public.staff_shifts s WHERE s.server_id = p_server AND s.discord_id = person.discord_id),
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

REVOKE ALL ON FUNCTION public.staff_shift_prepare(text), public.staff_shift_sync(text, text, jsonb),
    public.staff_shift_configure(text, boolean, boolean, integer, numeric),
    public.staff_shift_manual(text, text, text, text, text, boolean),
    public.staff_shift_seconds(text, text, timestamptz, timestamptz),
    public.staff_shift_report(text, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_shift_prepare(text), public.staff_shift_sync(text, text, jsonb),
    public.staff_shift_configure(text, boolean, boolean, integer, numeric),
    public.staff_shift_manual(text, text, text, text, text, boolean),
    public.staff_shift_seconds(text, text, timestamptz, timestamptz),
    public.staff_shift_report(text, text, timestamptz, integer) TO service_role;
