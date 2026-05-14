import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { normalizeAddonModule } from '@/lib/modules';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('addon_modules')
        .select('id, slug, name, description, version, category, status, source_checksum, config_schema, author_discord_id, created_at, updated_at, published_at')
        .eq('status', 'PUBLISHED')
        .order('name', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        modules: ((data || []) as Record<string, unknown>[])
            .map((row) => normalizeAddonModule(row, false))
            .filter(Boolean),
    });
}
