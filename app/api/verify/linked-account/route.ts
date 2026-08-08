import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE, DGSU_BAN_ERROR_STATUS } from '@/lib/dgsuBanConstants';
import { trimString } from '@/lib/serverDashboardAccess';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.error === DGSU_BAN_AUTH_ERROR) {
        return NextResponse.json({ error: DGSU_BAN_ERROR_MESSAGE }, { status: DGSU_BAN_ERROR_STATUS });
    }

    const userId = trimString((session.user as { id?: string }).id);
    if (!userId) {
        return NextResponse.json(null);
    }

    const client = getSupabaseAdmin();
    const { data, error } = await client
        .from('verified_users')
        .select('*')
        .eq('discord_id', userId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
}
