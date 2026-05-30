import { NextRequest, NextResponse } from 'next/server';

import { createStaffNote, fetchStaffNotes } from '@/lib/staffNotes';
import { canUseLivePanelUserTools, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAction } from '@/lib/logger';

type StaffNoteApiRow = {
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

async function isServerOwner(serverId: string, userId: string) {
    const token = process.env.DISCORD_TOKEN;
    if (!token || !serverId || !userId) {
        return false;
    }

    const response = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(serverId)}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
    });

    if (!response.ok) {
        console.error(`[StaffNotes] Failed to check guild owner (${response.status}) for ${serverId}`);
        return false;
    }

    const guild = await response.json().catch(() => null) as { owner_id?: string } | null;
    return guild?.owner_id === userId;
}

function attachDeletePermission<T extends StaffNoteApiRow>(notes: T[], userId: string, owner: boolean) {
    return notes.map((note) => ({
        ...note,
        can_delete: owner || note.created_by_discord_id === userId,
    }));
}

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireDashboardAccess(serverId, canUseLivePanelUserTools);
    if ('error' in access) {
        return access.error;
    }

    try {
        const [notes, owner] = await Promise.all([
            fetchStaffNotes(
                getSupabaseAdmin(),
                serverId,
                {
                    discordId: req.nextUrl.searchParams.get('discordId'),
                    robloxId: req.nextUrl.searchParams.get('robloxId'),
                    robloxUsername: req.nextUrl.searchParams.get('robloxUsername'),
                },
                10,
            ),
            isServerOwner(serverId, access.userId),
        ]);

        return NextResponse.json({ notes: attachDeletePermission(notes, access.userId, owner) });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load staff notes.' },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const serverId = trimString(body?.serverId);
    const access = await requireDashboardAccess(serverId, canUseLivePanelUserTools);
    if ('error' in access) {
        return access.error;
    }

    try {
        const staffTag = access.userId;
        const note = await createStaffNote(getSupabaseAdmin(), {
            serverId,
            target: {
                discordId: body?.discordId,
                robloxId: body?.robloxId,
                robloxUsername: body?.robloxUsername,
            },
            note: body?.note,
            createdByDiscordId: access.userId,
            createdByTag: staffTag,
        });

        await logAction(
            serverId,
            'STAFF_NOTE',
            note.target_roblox_username || note.target_roblox_id || note.target_discord_id || 'Unknown User',
            staffTag,
            'Staff note added',
        );

        const owner = await isServerOwner(serverId, access.userId);
        const [noteWithPermission] = attachDeletePermission([note], access.userId, owner);

        return NextResponse.json({ note: noteWithPermission });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save staff note.' },
            { status: 400 },
        );
    }
}

export async function DELETE(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const noteId = trimString(req.nextUrl.searchParams.get('noteId'));
    const access = await requireDashboardAccess(serverId, canUseLivePanelUserTools);
    if ('error' in access) {
        return access.error;
    }

    if (!noteId) {
        return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
    }

    try {
        const client = getSupabaseAdmin();
        const { data: note, error: noteError } = await client
            .from('staff_notes')
            .select('id, server_id, target_discord_id, target_roblox_id, target_roblox_username, note, created_by_discord_id, created_by_tag, created_at')
            .eq('server_id', serverId)
            .eq('id', noteId)
            .maybeSingle();

        if (noteError) {
            return NextResponse.json({ error: noteError.message }, { status: 500 });
        }

        const staffNote = note as StaffNoteApiRow | null;

        if (!staffNote) {
            return NextResponse.json({ error: 'Staff note not found' }, { status: 404 });
        }

        const owner = await isServerOwner(serverId, access.userId);
        if (!owner && staffNote.created_by_discord_id !== access.userId) {
            return NextResponse.json({ error: 'Only the server owner or note author can delete this note.' }, { status: 403 });
        }

        const { error: deleteError } = await client
            .from('staff_notes')
            .delete()
            .eq('server_id', serverId)
            .eq('id', noteId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        await logAction(
            serverId,
            'STAFF_NOTE_DELETE',
            staffNote.target_roblox_username || staffNote.target_roblox_id || staffNote.target_discord_id || 'Unknown User',
            access.userId,
            'Staff note deleted',
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete staff note.' },
            { status: 500 },
        );
    }
}
