import { NextResponse } from 'next/server';

const ADMINISTRATOR_PERMISSION = 0x8n;
const VIEW_CHANNEL_PERMISSION = 0x400n;
const SEND_MESSAGES_PERMISSION = 0x800n;

type DiscordGuildRecord = {
    id: string;
    owner_id: string;
};

type DiscordRoleRecord = {
    id: string;
    permissions?: string;
};

type DiscordMemberRecord = {
    roles?: string[];
};

type DiscordChannelOverwrite = {
    id: string;
    allow?: string;
    deny?: string;
};

type DiscordChannelRecord = {
    id: string;
    name: string;
    type: number;
    position: number;
    permission_overwrites?: DiscordChannelOverwrite[];
};

function parsePermissionBits(value?: string | null) {
    try {
        return BigInt(value || '0');
    } catch {
        return 0n;
    }
}

function computeBasePermissions(
    guildId: string,
    guild: DiscordGuildRecord,
    roles: DiscordRoleRecord[],
    member: DiscordMemberRecord,
    botUserId: string,
) {
    if (guild.owner_id === botUserId) {
        return ADMINISTRATOR_PERMISSION;
    }

    const memberRoleIds = new Set<string>(Array.isArray(member.roles) ? member.roles : []);
    let permissions = 0n;

    for (const role of roles) {
        if (role.id === guildId || memberRoleIds.has(role.id)) {
            permissions |= parsePermissionBits(role.permissions);
        }
    }

    return permissions;
}

function canBotSendToChannel(
    guildId: string,
    botUserId: string,
    basePermissions: bigint,
    member: DiscordMemberRecord,
    channel: DiscordChannelRecord,
) {
    if ((basePermissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION) {
        return true;
    }

    let permissions = basePermissions;
    const overwrites = Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites : [];

    const everyoneOverwrite = overwrites.find((overwrite) => overwrite.id === guildId);
    if (everyoneOverwrite) {
        permissions &= ~parsePermissionBits(everyoneOverwrite.deny);
        permissions |= parsePermissionBits(everyoneOverwrite.allow);
    }

    let roleDeny = 0n;
    let roleAllow = 0n;
    const memberRoleIds = new Set<string>(Array.isArray(member.roles) ? member.roles : []);
    for (const overwrite of overwrites) {
        if (overwrite.id !== guildId && memberRoleIds.has(overwrite.id)) {
            roleDeny |= parsePermissionBits(overwrite.deny);
            roleAllow |= parsePermissionBits(overwrite.allow);
        }
    }

    permissions &= ~roleDeny;
    permissions |= roleAllow;

    const memberOverwrite = overwrites.find((overwrite) => overwrite.id === botUserId);
    if (memberOverwrite) {
        permissions &= ~parsePermissionBits(memberOverwrite.deny);
        permissions |= parsePermissionBits(memberOverwrite.allow);
    }

    const canView = (permissions & VIEW_CHANNEL_PERMISSION) === VIEW_CHANNEL_PERMISSION;
    const canSend = (permissions & SEND_MESSAGES_PERMISSION) === SEND_MESSAGES_PERMISSION;
    return canView && canSend;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const guildId = searchParams.get('guildId');

    if (!guildId) {
        return NextResponse.json({ error: 'Guild ID required' }, { status: 400 });
    }

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const [botUserRes, guildRes, rolesRes, channelsRes] = await Promise.all([
            fetch('https://discord.com/api/v10/users/@me', {
                headers: { Authorization: `Bot ${botToken}` },
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
                headers: { Authorization: `Bot ${botToken}` },
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${botToken}` },
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                headers: { Authorization: `Bot ${botToken}` },
            }),
        ]);

        if (!botUserRes.ok || !guildRes.ok || !rolesRes.ok || !channelsRes.ok) {
            const failingResponse = [botUserRes, guildRes, rolesRes, channelsRes].find((response) => !response.ok);
            const error = failingResponse ? await failingResponse.json().catch(() => ({})) : {};
            return NextResponse.json(
                { error: error.message || 'Failed to fetch channels' },
                { status: failingResponse?.status || 500 },
            );
        }

        const botUser = await botUserRes.json();
        const guild = await guildRes.json() as DiscordGuildRecord;
        const roles = await rolesRes.json() as DiscordRoleRecord[];
        const channels = await channelsRes.json() as DiscordChannelRecord[];

        const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${botUser.id}`, {
            headers: { Authorization: `Bot ${botToken}` },
        });
        if (!memberRes.ok) {
            const error = await memberRes.json().catch(() => ({}));
            return NextResponse.json({ error: error.message || 'Failed to fetch bot membership' }, { status: memberRes.status });
        }

        const botMember = await memberRes.json() as DiscordMemberRecord;
        const basePermissions = computeBasePermissions(
            guildId,
            guild,
            Array.isArray(roles) ? roles : [],
            botMember,
            String(botUser.id || ''),
        );

        // Filter for Text Channels (type 0) and potentially Announcement Channels (type 5)
        const sendableChannels = channels
            .filter((channel) => channel.type === 0 || channel.type === 5)
            .filter((channel) => canBotSendToChannel(guildId, String(botUser.id || ''), basePermissions, botMember, channel))
            .sort((a, b) => a.position - b.position)
            .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                position: channel.position,
            }));

        return NextResponse.json(sendableChannels);
    } catch (err: any) {
        console.error("Discord API Error:", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
