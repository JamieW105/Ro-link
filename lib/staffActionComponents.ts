const STAFF_BLOCK_SERVER_CUSTOM_ID_PREFIX = 'staff_block_server';
const STAFF_VOID_MODERATION_CUSTOM_ID_PREFIX = 'staff_void_moderation';

export type StaffBlockServerCustomId = {
    guildId: string;
    ownerId: string;
    actionId: string;
};

export type StaffVoidModerationCustomId = {
    actionId: string;
};

export function buildStaffBlockServerCustomId(guildId: string, ownerId?: string | null, actionId?: string | null) {
    const normalizedGuildId = String(guildId ?? '').trim();
    const normalizedOwnerId = String(ownerId ?? '').trim();
    const normalizedActionId = String(actionId ?? '').trim();
    return [
        STAFF_BLOCK_SERVER_CUSTOM_ID_PREFIX,
        encodeURIComponent(normalizedGuildId),
        encodeURIComponent(normalizedOwnerId),
        encodeURIComponent(normalizedActionId),
    ].join('|');
}

export function parseStaffBlockServerCustomId(customId: string): StaffBlockServerCustomId | null {
    const [prefix, encodedGuildId = '', encodedOwnerId = '', encodedActionId = ''] = String(customId ?? '').split('|');
    if (prefix !== STAFF_BLOCK_SERVER_CUSTOM_ID_PREFIX) return null;

    const guildId = decodeURIComponent(encodedGuildId).trim();
    if (!guildId) return null;

    return {
        guildId,
        ownerId: decodeURIComponent(encodedOwnerId).trim(),
        actionId: decodeURIComponent(encodedActionId).trim(),
    };
}

export function buildStaffVoidModerationCustomId(actionId: string) {
    const normalizedActionId = String(actionId ?? '').trim();
    return [
        STAFF_VOID_MODERATION_CUSTOM_ID_PREFIX,
        encodeURIComponent(normalizedActionId),
    ].join('|');
}

export function parseStaffVoidModerationCustomId(customId: string): StaffVoidModerationCustomId | null {
    const [prefix, encodedActionId = ''] = String(customId ?? '').split('|');
    if (prefix !== STAFF_VOID_MODERATION_CUSTOM_ID_PREFIX) return null;

    const actionId = decodeURIComponent(encodedActionId).trim();
    if (!actionId) return null;

    return { actionId };
}

export function buildStaffActionModerationComponents(input: {
    actionType: 'removed' | 'blocked';
    actionId: string;
    guildId: string;
    ownerId?: string | null;
    blockDisabled?: boolean;
    blockLabel?: string;
    voidDisabled?: boolean;
    voidLabel?: string;
}) {
    const components: Array<Record<string, unknown>> = [];

    if (input.actionType === 'removed') {
        components.push({
            type: 2,
            style: 4,
            label: input.blockLabel || 'Block Server',
            custom_id: buildStaffBlockServerCustomId(input.guildId, input.ownerId, input.actionId),
            disabled: Boolean(input.blockDisabled),
        });
    }

    components.push({
        type: 2,
        style: 3,
        label: input.voidLabel || 'Void Moderation',
        custom_id: buildStaffVoidModerationCustomId(input.actionId),
        disabled: Boolean(input.voidDisabled),
    });

    return [{
        type: 1,
        components,
    }];
}

export function buildStaffBlockServerComponents(
    guildId: string,
    ownerId?: string | null,
    disabled = false,
    actionId?: string | null,
) {
    return [{
        type: 1,
        components: [{
            type: 2,
            style: 4,
            label: disabled ? 'Server Blocked' : 'Block Server',
            custom_id: buildStaffBlockServerCustomId(guildId, ownerId, actionId),
            disabled,
        }],
    }];
}
