import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { buildAppealThreadUrl, createAppealForumThread } from '@/lib/appealForumNotifications';
import { collectAppealableModeration } from '@/lib/moderationAppeals';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const APPEAL_RATE_LIMIT = {
    limit: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
};

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeEvidenceLinks(value: unknown) {
    const values = Array.isArray(value) ? value : trimString(value, 5000).split(/[\s,]+/g);
    return Array.from(new Set(values.map((item) => trimString(item, 500)).filter(Boolean))).slice(0, 10);
}

function withRateLimit(body: unknown, status: number, rateLimit: ReturnType<typeof consumeRateLimit>) {
    return NextResponse.json(body, { status, headers: rateLimitHeaders(rateLimit) });
}

async function getAppealContext() {
    const session = await getServerSession(authOptions);
    const discordId = trimString(session?.user?.id, 80);
    if (!session?.user || !discordId) {
        return { error: NextResponse.json({ error: 'Sign in with Discord to view your moderation records.' }, { status: 401 }) };
    }

    const context = await collectAppealableModeration({
        discordId,
        discordName: session.user.name,
        discordAccessToken: session.accessToken,
    });
    return { session, discordId, context };
}

export async function GET() {
    try {
        const result = await getAppealContext();
        if ('error' in result) return result.error;
        return NextResponse.json(result.context, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[Appeals] Failed to load appeal options:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load appealable moderation.' },
            { status: 500 },
        );
    }
}

export async function POST(req: Request) {
    let authResult: Awaited<ReturnType<typeof getAppealContext>>;
    try {
        authResult = await getAppealContext();
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load appealable moderation.' },
            { status: 500 },
        );
    }
    if ('error' in authResult) return authResult.error;

    const { discordId, context } = authResult;
    if (!context.linked) {
        return NextResponse.json({ error: 'Link your Roblox account before submitting an appeal.' }, { status: 403 });
    }

    const rateLimit = consumeRateLimit(`moderation-appeal:${discordId}`, APPEAL_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return withRateLimit(
            { error: `Too many appeal attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
            429,
            rateLimit,
        );
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return withRateLimit({ error: 'Invalid JSON body.' }, 400, rateLimit);
    }

    const moderationKey = trimString(body.moderationKey, 180);
    const appealReason = trimString(body.reason, 2000);
    const evidenceLinks = normalizeEvidenceLinks(body.evidenceLinks);
    const moderation = context.options.find((option) => option.key === moderationKey);

    if (!moderation) {
        return withRateLimit({ error: 'Select a moderation action that belongs to your account or server.' }, 400, rateLimit);
    }
    if (appealReason.length < 20) {
        return withRateLimit({ error: 'Appeal explanation must be at least 20 characters.' }, 400, rateLimit);
    }

    const client = getSupabaseAdmin();
    const { data: duplicate, error: duplicateError } = await client
        .from('moderation_appeals')
        .select('id, status, discord_thread_url')
        .eq('moderation_source', moderation.source)
        .eq('moderation_id', moderation.moderationId)
        .in('status', ['OPEN', 'REVIEWING'])
        .maybeSingle();
    if (duplicateError) {
        return withRateLimit({ error: duplicateError.message }, 500, rateLimit);
    }
    if (duplicate) {
        return withRateLimit({
            error: 'An open appeal already exists for this moderation action.',
            appealId: duplicate.id,
            threadUrl: duplicate.discord_thread_url,
        }, 409, rateLimit);
    }

    const { data: inserted, error: insertError } = await client
        .from('moderation_appeals')
        .insert({
            appellant_discord_id: context.identity.discordId,
            appellant_discord_name: context.identity.discordName,
            appellant_roblox_id: context.identity.robloxId,
            appellant_roblox_username: context.identity.robloxUsername,
            moderation_source: moderation.source,
            moderation_id: moderation.moderationId,
            target_type: moderation.targetType,
            target_id: moderation.targetId,
            original_forum_url: moderation.originalForumUrl,
            original_reason: moderation.reason,
            appeal_reason: appealReason,
            evidence_links: evidenceLinks,
        })
        .select('*')
        .single();
    if (insertError || !inserted) {
        return withRateLimit({ error: insertError?.message || 'Failed to create appeal.' }, 500, rateLimit);
    }

    try {
        const thread = await createAppealForumThread({
            appealId: inserted.id,
            identity: context.identity,
            moderation,
            appealReason,
            evidenceLinks,
        });
        const threadUrl = buildAppealThreadUrl(thread);
        const { error: updateError } = await client
            .from('moderation_appeals')
            .update({ discord_thread_id: thread.id, discord_thread_url: threadUrl })
            .eq('id', inserted.id);
        if (updateError) {
            console.error('[Appeals] Failed to save Discord thread details:', updateError);
        }
        return withRateLimit({ appealId: inserted.id, threadId: thread.id, threadUrl }, 201, rateLimit);
    } catch (error) {
        console.error('[Appeals] Failed to create Discord forum thread:', error);
        return withRateLimit({
            error: 'Appeal was stored, but Discord forum creation failed.',
            appealId: inserted.id,
        }, 502, rateLimit);
    }
}

