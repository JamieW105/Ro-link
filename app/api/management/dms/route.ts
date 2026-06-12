import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import { createDiscordDmChannel, sendDiscordMessage, type ModuleDiscordMessagePayload } from '@/lib/moduleDiscord';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const RO_LINK_NAME = 'Ro-Link';
const MANAGEMENT_DM_OPT_OUT_CUSTOM_ID = 'management_dm_opt_out';
const TARGETS = [
    'verified-linked-users',
    'server-owners-all',
    'server-owners-setup',
    'server-owners-without-setup',
] as const;

type TargetAudience = typeof TARGETS[number];

type BotGuildRecord = {
    id: string;
    name?: string | null;
    icon?: string | null;
};

type DiscordGuildRecord = {
    id: string;
    owner_id?: string | null;
};

type RecipientResolution = {
    recipients: string[];
    rawRecipients: string[];
    counts: Record<TargetAudience, number>;
    rawCounts: Record<TargetAudience, number>;
};

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

function clampText(value: unknown, maxLength: number) {
    const text = trimString(value);
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeSnowflake(value: unknown) {
    const text = trimString(value);
    return /^\d{5,32}$/.test(text) ? text : '';
}

function normalizeUrl(value: unknown) {
    const text = trimString(value);
    if (!/^https?:\/\//i.test(text)) {
        return '';
    }

    return text.length > 2048 ? text.slice(0, 2048) : text;
}

function normalizeColor(value: unknown) {
    const text = trimString(value).replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(text)) {
        return null;
    }

    return parseInt(text, 16);
}

function getRoLinkIconUrl() {
    const baseUrl = trimString(process.env.NEXT_PUBLIC_BASE_URL).replace(/\/+$/, '') || 'https://ro-link.com';
    return `${baseUrl}/Media/Ro-LinkIcon.png`;
}

function normalizeTarget(value: unknown): TargetAudience | null {
    const target = trimString(value) as TargetAudience;
    return TARGETS.includes(target) ? target : null;
}

function normalizeFields(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((field) => {
            if (!field || typeof field !== 'object') {
                return null;
            }

            const record = field as Record<string, unknown>;
            const name = clampText(record.name, 256);
            const fieldValue = clampText(record.value, 1024);

            if (!name || !fieldValue) {
                return null;
            }

            return {
                name,
                value: fieldValue,
                inline: record.inline === true,
            };
        })
        .filter(Boolean)
        .slice(0, 25) as Array<{ name: string; value: string; inline: boolean }>;
}

function buildMessagePayload(body: Record<string, unknown>): ModuleDiscordMessagePayload {
    const content = clampText(body.plainText, 2000);
    const title = clampText(body.embedTitle, 256);
    const description = clampText(body.description, 4096);
    let footerText = clampText(body.footerText, 2048);
    const color = normalizeColor(body.color);
    const removeSetColor = body.removeSetColor === true;
    const imageUrl = normalizeUrl(body.imageUrl);
    const thumbnailUrl = normalizeUrl(body.thumbnailUrl);
    const footerIconUrl = normalizeUrl(body.footerIconUrl);
    const fields = normalizeFields(body.fields);
    const roLinkIconUrl = getRoLinkIconUrl();

    if (!footerText) {
        const target = String(body.target || 'verified-linked-users');
        const sendingTypes: Record<string, string> = {
            'verified-linked-users': 'Verified Linked Users',
            'server-owners-all': 'Server Owners (All)',
            'server-owners-setup': 'Server Owners with Setup',
            'server-owners-without-setup': 'Server Owners without Setup',
        };
        const sendingType = sendingTypes[target] || 'Verified Linked Users';
        const timestamp = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
        footerText = `Sent by Ro-Link Staff to all ${sendingType}. | ${timestamp}`;
    }

    const embed: NonNullable<ModuleDiscordMessagePayload['embeds']>[number] = {
        author: {
            name: RO_LINK_NAME,
            icon_url: roLinkIconUrl,
        },
    };

    if (title) embed.title = title;
    if (description) embed.description = description;
    if (!removeSetColor && color !== null) embed.color = color;
    if (fields.length > 0) embed.fields = fields;
    if (imageUrl) embed.image = { url: imageUrl };
    if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };
    if (footerText) {
        embed.footer = {
            text: footerText,
            icon_url: footerIconUrl || roLinkIconUrl,
        };
    }

    const hasEmbed = Boolean(
        embed.title
        || embed.description
        || embed.fields?.length
        || embed.image
        || embed.thumbnail
        || embed.footer,
    );

    if (!content && !hasEmbed) {
        throw new Error('Add plaintext or at least one embed field before sending.');
    }

    const optOutEmbed = {
        title: "Don't want Ro-Link staff DMs?",
        description: "Opt out of Ro-Link feature DMs.\n*Block, moderation, and safety notices may still be sent.*",
        color: 0x64748b,
    };

    return {
        ...(content ? { content } : {}),
        embeds: [
            ...(hasEmbed ? [embed] : []),
            optOutEmbed,
        ],
        components: [{
            type: 1,
            components: [{
                type: 2,
                style: 2,
                label: 'Opt out',
                custom_id: MANAGEMENT_DM_OPT_OUT_CUSTOM_ID,
            }],
        }],
    };
}

async function requireDmPermission() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = String((session.user as { id?: unknown }).id ?? '');
    if (!(await hasPermission(userId, 'MANAGE_RO_LINK'))) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { userId };
}

async function listCurrentBotGuilds() {
    const token = trimString(process.env.DISCORD_TOKEN);
    if (!token) {
        throw new Error('Missing DISCORD_TOKEN');
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const guilds: BotGuildRecord[] = [];
    let after = '0';

    while (true) {
        const data = await rest.get(Routes.userGuilds(), {
            query: new URLSearchParams({ after, limit: '100' }),
        }) as BotGuildRecord[];

        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        guilds.push(...data.filter((guild) => normalizeSnowflake(guild.id)));
        after = data[data.length - 1].id;

        if (data.length < 100) {
            break;
        }
    }

    return { rest, guilds };
}

async function getSetupServerIds() {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('servers')
        .select('id');

    if (error) {
        throw new Error(error.message);
    }

    const ids = (data || [])
        .map((row: { id?: unknown }) => normalizeSnowflake(row.id))
        .filter((id: string): id is string => Boolean(id));

    return new Set<string>(ids);
}

async function getVerifiedLinkedUserIds() {
    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('verified_users')
        .select('discord_id, roblox_id');

    if (error) {
        throw new Error(error.message);
    }

    const userIds = (data || [])
        .filter((row: { discord_id?: unknown; roblox_id?: unknown }) => normalizeSnowflake(row.discord_id) && trimString(row.roblox_id))
        .map((row: { discord_id?: unknown }) => normalizeSnowflake(row.discord_id))
        .filter((discordId: string): discordId is string => Boolean(discordId));

    return Array.from(new Set<string>(
        userIds,
    ));
}

async function getManagementDmOptOutIds(userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds.map(normalizeSnowflake).filter(Boolean)));
    if (uniqueUserIds.length === 0) {
        return new Set<string>();
    }

    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('management_dm_opt_outs')
        .select('discord_id')
        .in('discord_id', uniqueUserIds);

    if (error) {
        throw new Error(error.message);
    }

    return new Set(
        (data || [])
            .map((row: { discord_id?: unknown }) => normalizeSnowflake(row.discord_id))
            .filter((discordId: string): discordId is string => Boolean(discordId)),
    );
}

async function resolveOwnerTargets() {
    const [{ rest, guilds }, setupServerIds] = await Promise.all([
        listCurrentBotGuilds(),
        getSetupServerIds(),
    ]);

    const ownerRows = await Promise.allSettled(
        guilds.map(async (guild) => {
            const detail = await rest.get(Routes.guild(guild.id)) as DiscordGuildRecord;
            const ownerId = normalizeSnowflake(detail.owner_id);
            if (!ownerId) {
                return null;
            }

            return {
                ownerId,
                isSetup: setupServerIds.has(guild.id),
            };
        }),
    );

    const ownerTargets = ownerRows
        .map((row) => row.status === 'fulfilled' ? row.value : null)
        .filter(Boolean) as Array<{ ownerId: string; isSetup: boolean }>;

    const all = new Set<string>();
    const setup = new Set<string>();
    const withoutSetup = new Set<string>();

    for (const target of ownerTargets) {
        all.add(target.ownerId);

        if (target.isSetup) {
            setup.add(target.ownerId);
        } else {
            withoutSetup.add(target.ownerId);
        }
    }

    return {
        all: Array.from(all),
        setup: Array.from(setup),
        withoutSetup: Array.from(withoutSetup),
    };
}

async function resolveRecipients(target: TargetAudience): Promise<RecipientResolution> {
    const [verifiedUsers, owners] = await Promise.all([
        getVerifiedLinkedUserIds(),
        resolveOwnerTargets(),
    ]);

    const rawCounts = {
        'verified-linked-users': verifiedUsers.length,
        'server-owners-all': owners.all.length,
        'server-owners-setup': owners.setup.length,
        'server-owners-without-setup': owners.withoutSetup.length,
    } satisfies Record<TargetAudience, number>;

    const rawRecipientsByTarget = {
        'verified-linked-users': verifiedUsers,
        'server-owners-all': owners.all,
        'server-owners-setup': owners.setup,
        'server-owners-without-setup': owners.withoutSetup,
    } satisfies Record<TargetAudience, string[]>;

    const allRawRecipients = Array.from(new Set([
        ...verifiedUsers,
        ...owners.all,
        ...owners.setup,
        ...owners.withoutSetup,
    ]));
    const optOutIds = await getManagementDmOptOutIds(allRawRecipients);
    const recipientsByTarget = {
        'verified-linked-users': rawRecipientsByTarget['verified-linked-users'].filter((recipient) => !optOutIds.has(recipient)),
        'server-owners-all': rawRecipientsByTarget['server-owners-all'].filter((recipient) => !optOutIds.has(recipient)),
        'server-owners-setup': rawRecipientsByTarget['server-owners-setup'].filter((recipient) => !optOutIds.has(recipient)),
        'server-owners-without-setup': rawRecipientsByTarget['server-owners-without-setup'].filter((recipient) => !optOutIds.has(recipient)),
    } satisfies Record<TargetAudience, string[]>;
    const counts = {
        'verified-linked-users': recipientsByTarget['verified-linked-users'].length,
        'server-owners-all': recipientsByTarget['server-owners-all'].length,
        'server-owners-setup': recipientsByTarget['server-owners-setup'].length,
        'server-owners-without-setup': recipientsByTarget['server-owners-without-setup'].length,
    } satisfies Record<TargetAudience, number>;
    const rawRecipients = rawRecipientsByTarget[target];

    return {
        recipients: recipientsByTarget[target],
        rawRecipients,
        counts,
        rawCounts,
    };
}

export async function GET() {
    const auth = await requireDmPermission();
    if ('error' in auth) {
        return auth.error;
    }

    try {
        const resolution = await resolveRecipients('verified-linked-users');
        return NextResponse.json({ counts: resolution.counts });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load DM targets.' },
            { status: 500 },
        );
    }
}

export async function POST(req: Request) {
    const auth = await requireDmPermission();
    if ('error' in auth) {
        return auth.error;
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const target = normalizeTarget(body.target);
    if (!target) {
        return NextResponse.json({ error: 'Choose a valid target audience.' }, { status: 400 });
    }

    let payload: ModuleDiscordMessagePayload;
    try {
        payload = buildMessagePayload(body);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Invalid message.' },
            { status: 400 },
        );
    }

    try {
        const { recipients, rawRecipients, counts, rawCounts } = await resolveRecipients(target);
        const results = {
            target,
            attempted: recipients.length,
            skippedOptedOut: rawRecipients.length - recipients.length,
            sent: 0,
            failed: 0,
            failures: [] as Array<{ userId: string; error: string }>,
            counts,
            rawCounts,
        };

        for (const userId of recipients) {
            try {
                const channelId = await createDiscordDmChannel(userId);
                await sendDiscordMessage(channelId, payload);
                results.sent += 1;
            } catch (error) {
                results.failed += 1;
                if (results.failures.length < 10) {
                    results.failures.push({
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown Discord error',
                    });
                }
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to send DMs.' },
            { status: 500 },
        );
    }
}
