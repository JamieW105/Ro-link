import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/management';
import {
    checksumModuleSource,
    normalizeAddonModule,
    sanitizeAddonModuleInput,
    slugifyModuleName,
    trimModuleString,
} from '@/lib/modules';
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

async function buildUniqueSlug(seed: string, moduleId: string) {
    const baseSlug = slugifyModuleName(seed);
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
        const { data, error } = await supabase
            .from('addon_modules')
            .select('id')
            .eq('slug', slug)
            .maybeSingle<{ id: string }>();

        if (error) {
            throw new Error(error.message);
        }

        if (!data || data.id === moduleId) {
            return slug;
        }

        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
    }
}

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(_req: Request, context: RouteContext) {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const { data, error } = await supabase
        .from('addon_modules')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeAddonModule(data, true));
}

export async function PATCH(req: Request, context: RouteContext) {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeAddonModuleInput(body, true);
    if ('errors' in sanitized) {
        return NextResponse.json({ error: sanitized.errors.join(' ') }, { status: 400 });
    }

    const input = sanitized.input;
    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.version !== undefined) updates.version = input.version;
    if (input.category !== undefined) updates.category = input.category;
    if (input.status !== undefined) {
        updates.status = input.status;
        updates.reviewed_at = input.status === 'PUBLISHED' || input.status === 'REJECTED'
            ? new Date().toISOString()
            : null;
        updates.reviewed_by_discord_id = input.status === 'PUBLISHED' || input.status === 'REJECTED'
            ? auth.userId
            : null;
        updates.published_at = input.status === 'PUBLISHED' ? new Date().toISOString() : null;
        if (input.status === 'PENDING_REVIEW') {
            updates.submitted_at = new Date().toISOString();
        }
    }
    if ('moderationNote' in body || 'moderation_note' in body) {
        updates.moderation_note = trimModuleString(body.moderationNote ?? body.moderation_note, 2000);
    }
    if (input.sourceCode !== undefined) {
        updates.source_code = input.sourceCode;
        updates.source_checksum = checksumModuleSource(input.sourceCode);
        updates.config_schema = input.configSchema || {};
    }
    if (input.slug !== undefined || input.name !== undefined) {
        updates.slug = await buildUniqueSlug(input.slug || input.name || 'module', id);
    }

    const { data, error } = await supabase
        .from('addon_modules')
        .update(updates)
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeAddonModule(data, true));
}

export async function DELETE(_req: Request, context: RouteContext) {
    const auth = await requireModuleManager();
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const { error } = await supabase
        .from('addon_modules')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
