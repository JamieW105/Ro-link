import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { createDiscordDmChannel, sendDiscordMessage } from '@/lib/moduleDiscord';
import { trimModuleString } from '@/lib/modules';
import { supabase } from '@/lib/supabase';

async function requireModuleManager() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = String((session.user as { id?: string }).id || '');
    if (!(await hasPermission(userId, 'MANAGE_MODULES'))) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { userId };
}

function getBaseUrl() {
    return (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function buildModuleCreatorTermsUrl() {
    return `${getBaseUrl()}/terms/modules/create`;
}

function buildMarketplaceUrl() {
    return `${getBaseUrl()}/dashboard/marketplace`;
}

async function notifyCreatorUploadBlocked(discordId: string, reason: string) {
    try {
        const channelId = await createDiscordDmChannel(discordId);
        const termsUrl = buildModuleCreatorTermsUrl();
        await sendDiscordMessage(channelId, {
            embeds: [
                {
                    title: 'Module Uploads Blocked',
                    url: termsUrl,
                    description: `You have been blocked from uploading Ro-Link marketplace modules.${reason ? `\n\n**Reason:** ${reason}` : ''}`,
                    color: 0xef4444,
                    fields: [
                        { name: 'Module Creator Terms', value: termsUrl },
                        { name: 'Marketplace', value: buildMarketplaceUrl() },
                    ],
                },
            ],
        });
    } catch (error) {
        console.error('[MODULES] Failed to DM blocked module creator', {
            discordId,
            error: error instanceof Error ? error.message : error,
        });
    }
}

export async function GET() {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const { data, error } = await supabase
        .from('addon_module_creator_blocks')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

export async function POST(req: Request) {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const discordId = trimModuleString(body.discordId ?? body.discord_id, 80);
    const reason = trimModuleString(body.reason, 1000);
    const active = body.active !== false;

    if (!discordId) {
        return NextResponse.json({ error: 'Discord user ID is required.' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('addon_module_creator_blocks')
        .upsert({
            discord_id: discordId,
            reason,
            active,
            blocked_by_discord_id: auth.userId,
            updated_at: new Date().toISOString(),
            ...(active ? { blocked_at: new Date().toISOString() } : {}),
        }, { onConflict: 'discord_id' })
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (active) {
        await notifyCreatorUploadBlocked(discordId, reason);
    }

    return NextResponse.json(data);
}
