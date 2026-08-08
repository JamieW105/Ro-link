import type { AppealIdentity, AppealModerationOption } from './moderationAppeals';

const APPEALS_FORUM_CHANNEL_ID = '1532302612429541517';
const APPEAL_TAG_IDS = {
    DISCORD_SERVER: '1532302680137928734',
    ROBLOX_GAME: '1532302704708288513',
    DISCORD_USER: '1532302730348068914',
    ROBLOX_USER: '1532302750761746522',
} as const;

type DiscordThreadResponse = {
    id: string;
    guild_id?: string;
};

function trimString(value: unknown, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function truncateText(value: unknown, maxLength: number) {
    const text = trimString(value, maxLength);
    return text || 'Not provided.';
}

async function discordApiFetch<T>(path: string, init: RequestInit) {
    const token = trimString(process.env.DISCORD_TOKEN, 4000);
    if (!token) throw new Error('Missing DISCORD_TOKEN.');

    const response = await fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(`Discord API request failed (${response.status}): ${JSON.stringify(payload)}`);
    }
    return payload as T;
}

export function buildAppealThreadUrl(thread: DiscordThreadResponse) {
    return thread.guild_id
        ? `https://discord.com/channels/${encodeURIComponent(thread.guild_id)}/${encodeURIComponent(thread.id)}`
        : `https://discord.com/channels/@me/${encodeURIComponent(thread.id)}`;
}

export async function createAppealForumThread(input: {
    appealId: string;
    identity: AppealIdentity;
    moderation: AppealModerationOption;
    appealReason: string;
    evidenceLinks: string[];
}) {
    const originalPost = input.moderation.originalForumUrl
        ? `[Open original forum post](${input.moderation.originalForumUrl})`
        : 'No original forum post is available for this moderation record.';
    const evidence = input.evidenceLinks.length
        ? input.evidenceLinks.map((link, index) => `[Evidence ${index + 1}](${link})`).join('\n')
        : 'No additional evidence supplied.';
    const shortAppealId = trimString(input.appealId, 80).slice(0, 8);
    const name = truncateText(`Appeal ${input.moderation.targetLabel} - ${shortAppealId}`, 100);

    return discordApiFetch<DiscordThreadResponse>(`/channels/${APPEALS_FORUM_CHANNEL_ID}/threads`, {
        method: 'POST',
        body: JSON.stringify({
            name,
            auto_archive_duration: 10080,
            applied_tags: [APPEAL_TAG_IDS[input.moderation.targetType]],
            message: {
                content: input.moderation.originalForumUrl
                    ? `Original forum post: ${input.moderation.originalForumUrl}`
                    : undefined,
                embeds: [{
                    title: 'Ro-Link Moderation Appeal',
                    color: 0x0ea5e9,
                    fields: [
                        { name: 'Appeal ID', value: `\`${input.appealId}\``, inline: true },
                        { name: 'Moderation', value: truncateText(input.moderation.targetLabel, 1024), inline: true },
                        { name: 'Moderation ID', value: `\`${input.moderation.moderationId}\``, inline: false },
                        { name: 'Discord User', value: `<@${input.identity.discordId}>\n\`${input.identity.discordId}\``, inline: true },
                        {
                            name: 'Linked Roblox User',
                            value: `${truncateText(input.identity.robloxUsername, 200)}\n\`${input.identity.robloxId}\``,
                            inline: true,
                        },
                        { name: 'Original Moderation Reason', value: truncateText(input.moderation.reason, 1024), inline: false },
                        { name: 'Appeal', value: truncateText(input.appealReason, 1024), inline: false },
                        { name: 'Additional Evidence', value: truncateText(evidence, 1024), inline: false },
                        { name: 'Original Forum Post', value: truncateText(originalPost, 1024), inline: false },
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Ro-Link Appeals' },
                }],
                allowed_mentions: { parse: [] },
            },
        }),
    });
}

