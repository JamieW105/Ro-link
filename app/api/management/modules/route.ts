import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import {
    checksumModuleSource,
    normalizeAddonModule,
    sanitizeAddonModuleInput,
    slugifyModuleName,
} from '@/lib/modules';
import { applyOfficialModuleLabels, getRoLinkStaffDiscordIds } from '@/lib/moduleOfficial';
import { supabase } from '@/lib/supabase';

async function requireModuleManager() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = String((session.user as { id?: string }).id || '');
    if (!(await hasPermission(userId, 'MANAGE_MODULES'))) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { session, userId };
}

async function buildUniqueSlug(seed: string) {
    const baseSlug = slugifyModuleName(seed);
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
        const { data, error } = await supabase
            .from('addon_modules')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            throw new Error(error.message);
        }

        if (!data) {
            return slug;
        }

        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
    }
}

export async function GET() {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const { data, error } = await supabase
        .from('addon_modules')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();

    return NextResponse.json(
        applyOfficialModuleLabels((data || []) as Record<string, unknown>[], staffDiscordIds)
            .map((row) => normalizeAddonModule(row, true))
            .filter(Boolean),
    );
}

export async function POST(req: Request) {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeAddonModuleInput(body);
    if ('errors' in sanitized) {
        return NextResponse.json({ error: sanitized.errors.join(' ') }, { status: 400 });
    }

    const input = sanitized.input;
    const slug = await buildUniqueSlug(input.slug || input.name || 'module');
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('addon_modules')
        .insert({
            slug,
            name: input.name,
            description: input.description || '',
            version: input.version || '1.0.0',
            category: input.category || 'General',
            status: input.status || 'DRAFT',
            source_code: input.sourceCode,
            source_checksum: checksumModuleSource(input.sourceCode || ''),
            config_schema: input.configSchema || {},
            author_discord_id: auth.userId,
            submitted_at: input.status === 'PENDING_REVIEW' ? now : null,
            reviewed_at: input.status === 'PUBLISHED' || input.status === 'REJECTED' ? now : null,
            reviewed_by_discord_id: input.status === 'PUBLISHED' || input.status === 'REJECTED' ? auth.userId : null,
            moderation_note: '',
            published_at: input.status === 'PUBLISHED' ? now : null,
            updated_at: now,
        })
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();
    const [labeledModule] = applyOfficialModuleLabels([data as Record<string, unknown>], staffDiscordIds);

    return NextResponse.json(normalizeAddonModule(labeledModule, true));
}
