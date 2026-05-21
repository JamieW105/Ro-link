import { NextRequest, NextResponse } from 'next/server';

import { createStaffNote, fetchStaffNotes } from '@/lib/staffNotes';
import { canLookup, requireDashboardAccess, trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAction } from '@/lib/logger';

export async function GET(req: NextRequest) {
    const serverId = trimString(req.nextUrl.searchParams.get('serverId'));
    const access = await requireDashboardAccess(serverId, canLookup);
    if ('error' in access) {
        return access.error;
    }

    try {
        const notes = await fetchStaffNotes(
            getSupabaseAdmin(),
            serverId,
            {
                discordId: req.nextUrl.searchParams.get('discordId'),
                robloxId: req.nextUrl.searchParams.get('robloxId'),
                robloxUsername: req.nextUrl.searchParams.get('robloxUsername'),
            },
            10,
        );

        return NextResponse.json({ notes });
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
    const access = await requireDashboardAccess(serverId, canLookup);
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

        return NextResponse.json({ note });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save staff note.' },
            { status: 400 },
        );
    }
}
