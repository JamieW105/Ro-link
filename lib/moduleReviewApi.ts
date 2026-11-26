import type { SupabaseClient } from '@supabase/supabase-js';
import { getDiscordMediaProxyUrl } from './discordMedia';

export interface ReviewSession {
    user?: { id?: string; name?: string | null; image?: string | null };
    accessToken?: string;
    error?: string;
}
interface ReviewDependencies {
    session: () => Promise<ReviewSession | null>;
    db: () => SupabaseClient;
    configured: () => boolean;
    visibleGuildIds: (session: ReviewSession) => Promise<string[]>;
    canManage: (serverId: string, discordId: string) => Promise<boolean>;
}
export const REVIEW_PAGE_SIZE = 10;
export function parseModuleReview(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const body = value as Record<string, unknown>;
    if (typeof body.rating !== 'number' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.comment !== 'string') return null;
    const comment = body.comment.trim();
    return comment.length >= 1 && comment.length <= 2000 ? { rating: body.rating, comment } : null;
}

export function createModuleReviewHandlers(deps: ReviewDependencies) {
    async function access(moduleId: string): Promise<{ response: Response } | { db: SupabaseClient; session: ReviewSession; discordId: string; ownModule: boolean }> {
        const session = await deps.session();
        if (!session?.user?.id || session.error) return { response: Response.json({ error: 'Sign in to access module reviews.' }, { status: 401 }) };
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(moduleId)) return { response: Response.json({ error: 'Invalid module.' }, { status: 400 }) };
        if (!deps.configured()) return { response: Response.json({ error: 'Reviews require server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.', code: 'REVIEWS_NOT_CONFIGURED' }, { status: 503 }) };
        const db = deps.db();
        const { data: module, error } = await db.from('addon_modules').select('id, status, author_discord_id').eq('id', moduleId).maybeSingle();
        if (error) throw error;
        const ownModule = module?.author_discord_id === session.user.id;
        if (!module || (module.status !== 'PUBLISHED' && !ownModule)) return { response: Response.json({ error: 'Module not found.' }, { status: 404 }) };
        return { db, session, discordId: session.user.id, ownModule };
    }
    async function eligible(db: SupabaseClient, session: ReviewSession, moduleId: string, ownModule: boolean) {
        if (ownModule) return true;
        if (!session.accessToken) return false;
        const guildIds = await deps.visibleGuildIds(session);
        if (!guildIds.length) return false;
        const { data, error } = await db.from('server_addon_modules').select('server_id').eq('module_id', moduleId).in('server_id', guildIds);
        if (error) throw error;
        for (const row of data || []) {
            if (await deps.canManage(String(row.server_id), session.user!.id!)) return true;
        }
        return false;
    }
    async function handle(request: Request, moduleId: string, method: 'GET' | 'POST' | 'DELETE'): Promise<Response> {
        try {
            const context = await access(moduleId);
            if ('response' in context) return context.response;
            const { db, session, discordId, ownModule } = context;
            if (method === 'GET') {
                const offset = Number(new URL(request.url).searchParams.get('offset') || 0);
                if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) return Response.json({ error: 'Invalid review page.' }, { status: 400 });
                const canReview = await eligible(db, session, moduleId, ownModule);
                const { data, error } = await db.rpc('module_review_summary', { p_module: moduleId, p_discord: discordId, p_offset: offset });
                if (error) throw error;
                return Response.json({ ...data, canReview, ownModule }, { headers: { 'Cache-Control': 'private, no-store' } });
            }
            if (method === 'DELETE') {
                const { error } = await db.from('addon_module_reviews').delete().eq('module_id', moduleId).eq('reviewer_discord_id', discordId);
                if (error) throw error;
                return Response.json({ ok: true });
            }
            const body = parseModuleReview(await request.json().catch(() => null));
            if (!body) return Response.json({ error: 'Choose 1–5 stars and write a review of 1–2000 characters.' }, { status: 400 });
            if (!await eligible(db, session, moduleId, ownModule)) return Response.json({ error: 'Install this module on a server you manage before reviewing it.' }, { status: 403 });
            const { error } = await db.from('addon_module_reviews').upsert({
                module_id: moduleId,
                reviewer_discord_id: discordId,
                reviewer_name: session.user?.name?.trim().slice(0, 100) || 'Discord member',
                reviewer_avatar_url: getDiscordMediaProxyUrl(session.user?.image),
                rating: body.rating,
                comment: body.comment,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'module_id,reviewer_discord_id' });
            if (error) throw error;
            return Response.json({ ok: true });
        } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
            // Log only a database error code; query details can contain reviewer data.
            console.error('[module-reviews]', { method, code });
            if (['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(code)) {
                return Response.json({ error: 'Reviews database setup is incomplete. Apply the reconcile_module_reviews migration.', code: 'REVIEWS_SCHEMA_MISSING' }, { status: 503 });
            }
            return Response.json({ error: 'Reviews are temporarily unavailable. Please try again.' }, { status: 503 });
        }
    }
    return {
        GET: (request: Request, moduleId: string) => handle(request, moduleId, 'GET'),
        POST: (request: Request, moduleId: string) => handle(request, moduleId, 'POST'),
        DELETE: (request: Request, moduleId: string) => handle(request, moduleId, 'DELETE'),
    };
}
