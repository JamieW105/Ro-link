import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import {
    buildPublicReportThreadUrl,
    collectPublicReportForumContext,
    createPublicReportForumThread,
    type PublicReportRecord,
    type PublicReportTargetType,
    targetTypeLabel,
} from '@/lib/publicReportForumNotifications';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const DISCORD_ID_PATTERN = /^\d{17,20}$/;
const ROBLOX_ID_PATTERN = /^\d{1,20}$/;
const PUBLIC_REPORT_RATE_LIMIT = {
    limit: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
};

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeChoice(value: unknown) {
    return trimString(value, 80).toLowerCase().replace(/[\s-]+/g, '_');
}

function resolveTargetType(body: Record<string, unknown>): PublicReportTargetType | null {
    const targetKind = normalizeChoice(body.targetKind ?? body.reportType ?? body.type);
    const userPlatform = normalizeChoice(body.userPlatform ?? body.platform);

    if (targetKind === 'roblox_game' || targetKind === 'game' || targetKind === 'rblx_game') {
        return 'ROBLOX_GAME';
    }

    if (targetKind === 'discord_server' || targetKind === 'server' || targetKind === 'guild') {
        return 'DISCORD_SERVER';
    }

    if (targetKind === 'roblox_user') {
        return 'ROBLOX_USER';
    }

    if (targetKind === 'discord_user') {
        return 'DISCORD_USER';
    }

    if (targetKind === 'user') {
        if (userPlatform === 'roblox' || userPlatform === 'rblx') return 'ROBLOX_USER';
        if (userPlatform === 'discord') return 'DISCORD_USER';
    }

    return null;
}

function normalizeEvidenceLinks(value: unknown) {
    const rawLinks = Array.isArray(value)
        ? value
        : trimString(value, 5000).split(/[\s,]+/g);

    const deduped = new Set<string>();
    for (const rawLink of rawLinks) {
        const link = trimString(rawLink, 500);
        if (link) {
            deduped.add(link);
        }
    }

    return Array.from(deduped).slice(0, 10);
}

function isDiscordImageUrl(value: string) {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();
        const isDiscordHost = hostname.endsWith('discordapp.com')
            || hostname.endsWith('discordapp.net')
            || hostname === 'discord.com'
            || hostname.endsWith('.discord.com');
        const looksLikeImage = /\.(png|jpe?g|gif|webp)(?:$|\?)/i.test(url.pathname)
            || url.pathname.includes('/attachments/');

        return url.protocol === 'https:' && isDiscordHost && looksLikeImage;
    } catch {
        return false;
    }
}

function validateTargetId(targetType: PublicReportTargetType, targetId: string) {
    if (targetType === 'DISCORD_USER' || targetType === 'DISCORD_SERVER') {
        return DISCORD_ID_PATTERN.test(targetId);
    }

    return ROBLOX_ID_PATTERN.test(targetId);
}

function responseWithRateLimit(body: unknown, init: ResponseInit, rateLimit: ReturnType<typeof consumeRateLimit>) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            ...(init.headers || {}),
            ...rateLimitHeaders(rateLimit),
        },
    });
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (session?.error === DGSU_BAN_AUTH_ERROR) {
        return NextResponse.json({ error: DGSU_BAN_ERROR_MESSAGE }, { status: DGSU_BAN_ERROR_STATUS });
    }

    if (!session?.user || session.error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reporterDiscordId = trimString((session.user as { id?: string }).id, 80);
    if (!reporterDiscordId) {
        return NextResponse.json({ error: 'Unable to identify signed-in Discord user.' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(`public-report:${reporterDiscordId}`, PUBLIC_REPORT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return responseWithRateLimit(
            { error: `Too many reports. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
            { status: 429 },
            rateLimit,
        );
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return responseWithRateLimit({ error: 'Invalid JSON body.' }, { status: 400 }, rateLimit);
    }

    const targetType = resolveTargetType(body);
    const targetId = trimString(body.targetId ?? body.id, 80);
    const reason = trimString(body.reason, 2000);
    const evidenceLinks = normalizeEvidenceLinks(body.evidenceLinks ?? body.evidence);

    if (!targetType) {
        return responseWithRateLimit({ error: 'Select Roblox game, Discord server, Roblox user, or Discord user.' }, { status: 400 }, rateLimit);
    }

    if (!targetId || !validateTargetId(targetType, targetId)) {
        return responseWithRateLimit({ error: `Enter a valid ${targetTypeLabel(targetType)} ID.` }, { status: 400 }, rateLimit);
    }

    if (reason.length < 15) {
        return responseWithRateLimit({ error: 'Reason must be at least 15 characters.' }, { status: 400 }, rateLimit);
    }

    if (evidenceLinks.length === 0) {
        return responseWithRateLimit({ error: 'At least one Discord image evidence link is required.' }, { status: 400 }, rateLimit);
    }

    const invalidEvidenceLink = evidenceLinks.find((link) => !isDiscordImageUrl(link));
    if (invalidEvidenceLink) {
        return responseWithRateLimit(
            { error: 'Evidence links must be Discord-hosted image links.' },
            { status: 400 },
            rateLimit,
        );
    }

    const client = getSupabaseAdmin();

    try {
        const context = await collectPublicReportForumContext({
            reporterDiscordId,
            targetType,
            targetId,
            client,
        });

        const verifiedUser = context.reporterLookup.verifiedUser;
        const discordUser = context.reporterLookup.discordUser;
        const reporterTag = discordUser?.username
            ? discordUser.discriminator && discordUser.discriminator !== '0'
                ? `${discordUser.username}#${discordUser.discriminator}`
                : `@${discordUser.username}`
            : trimString(session.user.name, 120) || null;

        const { data: insertedReport, error: insertError } = await client
            .from('public_reports')
            .insert({
                reporter_discord_id: reporterDiscordId,
                reporter_discord_tag: reporterTag,
                reporter_roblox_id: trimString(verifiedUser?.roblox_id, 80) || null,
                reporter_roblox_username: trimString(verifiedUser?.roblox_username, 120) || null,
                target_type: targetType,
                target_id: targetId,
                reason,
                evidence_links: evidenceLinks,
            })
            .select('*')
            .single();

        if (insertError || !insertedReport) {
            console.error('[Public Reports] Failed to create report row:', insertError);
            return responseWithRateLimit(
                { error: insertError?.message || 'Failed to create report.' },
                { status: 500 },
                rateLimit,
            );
        }

        const report = insertedReport as PublicReportRecord;

        try {
            const thread = await createPublicReportForumThread({ report, context });
            const threadUrl = buildPublicReportThreadUrl(thread);

            const { data: updatedReport, error: updateError } = await client
                .from('public_reports')
                .update({
                    discord_thread_id: thread.id,
                    discord_thread_url: threadUrl,
                })
                .eq('id', report.id)
                .select('*')
                .single();

            if (updateError) {
                console.error('[Public Reports] Failed to update report forum thread:', updateError);
            }

            return responseWithRateLimit(
                {
                    reportId: report.id,
                    threadId: thread.id,
                    threadUrl,
                    report: updatedReport || report,
                },
                { status: 201 },
                rateLimit,
            );
        } catch (threadError) {
            console.error('[Public Reports] Failed to create Discord forum thread:', threadError);
            return responseWithRateLimit(
                {
                    error: 'Report was stored, but Discord forum creation failed.',
                    reportId: report.id,
                },
                { status: 502 },
                rateLimit,
            );
        }
    } catch (error) {
        console.error('[Public Reports] Submission failed:', error);
        return responseWithRateLimit(
            { error: error instanceof Error ? error.message : 'Failed to submit report.' },
            { status: 500 },
            rateLimit,
        );
    }
}
