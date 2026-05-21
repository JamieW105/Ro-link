type StaffNotesClient = {
    from: (table: string) => any;
};

export type StaffNoteTarget = {
    discordId?: unknown;
    robloxId?: unknown;
    robloxUsername?: unknown;
};

export type StaffNoteRow = {
    id: string;
    server_id: string;
    target_discord_id: string | null;
    target_roblox_id: string | null;
    target_roblox_username: string | null;
    note: string;
    created_by_discord_id: string | null;
    created_by_tag: string | null;
    created_at: string;
};

function cleanText(value: unknown, maxLength = 256) {
    return String(value ?? '').trim().slice(0, maxLength);
}

export function normalizeStaffNoteTarget(target: StaffNoteTarget) {
    const discordId = cleanText(target.discordId, 32);
    const robloxId = cleanText(target.robloxId, 32);
    const robloxUsername = cleanText(target.robloxUsername, 64);

    return {
        discordId: discordId || null,
        robloxId: robloxId || null,
        robloxUsername: robloxUsername || null,
        robloxUsernameLower: robloxUsername ? robloxUsername.toLowerCase() : null,
    };
}

export function normalizeStaffNoteBody(value: unknown) {
    return cleanText(value, 1500);
}

export function getStaffNoteTargetLabel(target: StaffNoteTarget) {
    const normalized = normalizeStaffNoteTarget(target);
    if (normalized.robloxUsername) return normalized.robloxUsername;
    if (normalized.robloxId) return `Roblox ID ${normalized.robloxId}`;
    if (normalized.discordId) return `Discord ID ${normalized.discordId}`;
    return 'Unknown User';
}

export async function fetchStaffNotes(
    client: StaffNotesClient,
    serverId: string,
    target: StaffNoteTarget,
    limit = 5,
): Promise<StaffNoteRow[]> {
    const normalized = normalizeStaffNoteTarget(target);
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 25));

    if (!serverId || (!normalized.discordId && !normalized.robloxId && !normalized.robloxUsernameLower)) {
        return [];
    }

    const baseQuery = () => client
        .from('staff_notes')
        .select('id, server_id, target_discord_id, target_roblox_id, target_roblox_username, note, created_by_discord_id, created_by_tag, created_at')
        .eq('server_id', serverId)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

    const queries = [];
    if (normalized.discordId) queries.push(baseQuery().eq('target_discord_id', normalized.discordId));
    if (normalized.robloxId) queries.push(baseQuery().eq('target_roblox_id', normalized.robloxId));
    if (normalized.robloxUsernameLower) queries.push(baseQuery().eq('target_roblox_username_lower', normalized.robloxUsernameLower));

    const results = await Promise.all(queries);
    const rows = new Map<string, StaffNoteRow>();

    for (const { data, error } of results) {
        if (error) {
            throw new Error(error.message || 'Failed to load staff notes.');
        }

        for (const row of Array.isArray(data) ? data as StaffNoteRow[] : []) {
            rows.set(row.id, row);
        }
    }

    return Array.from(rows.values())
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, safeLimit);
}

export async function createStaffNote(
    client: StaffNotesClient,
    input: {
        serverId: string;
        target: StaffNoteTarget;
        note: unknown;
        createdByDiscordId?: unknown;
        createdByTag?: unknown;
    },
) {
    const normalized = normalizeStaffNoteTarget(input.target);
    const note = normalizeStaffNoteBody(input.note);

    if (!input.serverId) {
        throw new Error('Server ID is required.');
    }

    if (!normalized.discordId && !normalized.robloxId && !normalized.robloxUsername) {
        throw new Error('Choose a Discord user or Roblox user before adding a note.');
    }

    if (!note) {
        throw new Error('Note cannot be empty.');
    }

    const { data, error } = await client
        .from('staff_notes')
        .insert([{
            server_id: input.serverId,
            target_discord_id: normalized.discordId,
            target_roblox_id: normalized.robloxId,
            target_roblox_username: normalized.robloxUsername,
            target_roblox_username_lower: normalized.robloxUsernameLower,
            note,
            created_by_discord_id: cleanText(input.createdByDiscordId, 32) || null,
            created_by_tag: cleanText(input.createdByTag, 128) || 'Unknown Staff',
        }])
        .select('id, server_id, target_discord_id, target_roblox_id, target_roblox_username, note, created_by_discord_id, created_by_tag, created_at')
        .single();

    if (error) {
        throw new Error(error.message || 'Failed to save staff note.');
    }

    return data as StaffNoteRow;
}
