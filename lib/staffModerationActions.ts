import { getSupabaseAdmin } from './supabaseAdmin';

export type StaffModerationActionType = 'removed' | 'blocked';
export type StaffModerationActionStatus = 'ACTIVE' | 'VOIDED';

export type StaffModerationActionRecord = {
    id: string;
    action_type: StaffModerationActionType;
    guild_id: string;
    guild_name: string | null;
    owner_id: string | null;
    reason: string | null;
    created_by: string;
    created_at: string;
    status: StaffModerationActionStatus;
    voided_by: string | null;
    voided_at: string | null;
    forum_thread_id: string | null;
};

type SupabaseClientLike = ReturnType<typeof getSupabaseAdmin>;

function trimString(value: unknown) {
    return String(value ?? '').trim();
}

export async function createStaffModerationAction(input: {
    actionType: StaffModerationActionType;
    guildId: string;
    guildName?: string | null;
    ownerId?: string | null;
    staffDiscordId: string;
    reason?: string | null;
}) {
    const client = getSupabaseAdmin();
    const guildId = trimString(input.guildId);
    const staffDiscordId = trimString(input.staffDiscordId);

    if (!guildId) {
        throw new Error('Missing guild id for staff moderation action.');
    }

    if (!staffDiscordId) {
        throw new Error('Missing staff Discord id for staff moderation action.');
    }

    const { data, error } = await client
        .from('staff_moderation_actions')
        .insert({
            action_type: input.actionType,
            guild_id: guildId,
            guild_name: trimString(input.guildName) || null,
            owner_id: trimString(input.ownerId) || null,
            reason: trimString(input.reason) || null,
            created_by: staffDiscordId,
        })
        .select('*')
        .single();

    if (error || !data) {
        throw new Error(error?.message || 'Failed to create staff moderation action.');
    }

    return data as StaffModerationActionRecord;
}

export async function updateStaffModerationActionForumThread(actionId: string, forumThreadId: string | null) {
    const normalizedActionId = trimString(actionId);
    if (!normalizedActionId || !forumThreadId) return;

    const client = getSupabaseAdmin();
    const { error } = await client
        .from('staff_moderation_actions')
        .update({ forum_thread_id: forumThreadId })
        .eq('id', normalizedActionId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function recordStaffModerationActionLog(input: {
    action: StaffModerationActionRecord;
    logAction: string;
    target?: string | null;
}) {
    const client = getSupabaseAdmin();
    const { error } = await client
        .from('logs')
        .insert([{
            server_id: input.action.guild_id,
            action: input.logAction,
            target: trimString(input.target) || input.action.guild_id,
            moderator: input.action.created_by,
            timestamp: new Date().toISOString(),
            moderation_action_id: input.action.id,
        }]);

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchStaffModerationAction(actionId: string, client: SupabaseClientLike = getSupabaseAdmin()) {
    const normalizedActionId = trimString(actionId);
    if (!normalizedActionId) return null;

    const { data, error } = await client
        .from('staff_moderation_actions')
        .select('*')
        .eq('id', normalizedActionId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data as StaffModerationActionRecord | null;
}

export async function voidStaffModerationAction(actionId: string, voidedBy: string) {
    const client = getSupabaseAdmin();
    const action = await fetchStaffModerationAction(actionId, client);
    if (!action) {
        throw new Error('Moderation action not found.');
    }

    if (action.status === 'VOIDED') {
        return { action, alreadyVoided: true };
    }

    const { error: logsError } = await client
        .from('logs')
        .delete()
        .eq('moderation_action_id', action.id);

    if (logsError) {
        throw new Error(logsError.message);
    }

    const { error: blockError } = await client
        .from('blocked_servers')
        .delete()
        .eq('moderation_action_id', action.id);

    if (blockError) {
        throw new Error(blockError.message);
    }

    const voidedAt = new Date().toISOString();
    const { data, error } = await client
        .from('staff_moderation_actions')
        .update({
            status: 'VOIDED',
            voided_by: trimString(voidedBy) || null,
            voided_at: voidedAt,
        })
        .eq('id', action.id)
        .select('*')
        .single();

    if (error || !data) {
        throw new Error(error?.message || 'Failed to void staff moderation action.');
    }

    return { action: data as StaffModerationActionRecord, alreadyVoided: false };
}
