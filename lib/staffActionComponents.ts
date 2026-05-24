const STAFF_BLOCK_SERVER_CUSTOM_ID_PREFIX = 'staff_block_server';

export type StaffBlockServerCustomId = {
    guildId: string;
    ownerId: string;
};

export function buildStaffBlockServerCustomId(guildId: string, ownerId?: string | null) {
    const normalizedGuildId = String(guildId ?? '').trim();
    const normalizedOwnerId = String(ownerId ?? '').trim();
    return [
        STAFF_BLOCK_SERVER_CUSTOM_ID_PREFIX,
        encodeURIComponent(normalizedGuildId),
        encodeURIComponent(normalizedOwnerId),
    ].join('|');
}

export function parseStaffBlockServerCustomId(customId: string): StaffBlockServerCustomId | null {
    const [prefix, encodedGuildId = '', encodedOwnerId = ''] = String(customId ?? '').split('|');
    if (prefix !== STAFF_BLOCK_SERVER_CUSTOM_ID_PREFIX) return null;

    const guildId = decodeURIComponent(encodedGuildId).trim();
    if (!guildId) return null;

    return {
        guildId,
        ownerId: decodeURIComponent(encodedOwnerId).trim(),
    };
}

export function buildStaffBlockServerComponents(guildId: string, ownerId?: string | null, disabled = false) {
    return [{
        type: 1,
        components: [{
            type: 2,
            style: 4,
            label: disabled ? 'Server Blocked' : 'Block Server',
            custom_id: buildStaffBlockServerCustomId(guildId, ownerId),
            disabled,
        }],
    }];
}
