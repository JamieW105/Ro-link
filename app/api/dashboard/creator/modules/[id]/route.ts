import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
    checksumModuleSource,
    findDuplicateAddonModuleSubmission,
    normalizeAddonModule,
    sanitizeAddonModuleInput,
    slugifyModuleName,
    trimModuleString,
} from '@/lib/modules';
import { applyVerifiedCreatorBadges } from '@/lib/moduleCreatorVerification';
import { applyOfficialModuleLabels, getRoLinkStaffDiscordIds } from '@/lib/moduleOfficial';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

type CreatorWritableStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ARCHIVED';

async function requireCreator() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const userId = String((session.user as { id?: string }).id || '');
    if (!userId) {
        return { error: NextResponse.json({ error: 'Discord user ID is required.' }, { status: 400 }) };
    }

    return { session, userId };
}

function getCreatorWritableStatus(value: unknown): CreatorWritableStatus | null {
    const status = trimModuleString(value, 20).toUpperCase();
    if (status === 'DRAFT' || status === 'PENDING_REVIEW' || status === 'ARCHIVED') {
        return status;
    }
    return null;
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

async function getActiveCreatorBlock(discordId: string) {
    const { data, error } = await supabase
        .from('addon_module_creator_blocks')
        .select('reason')
        .eq('discord_id', discordId)
        .eq('active', true)
        .maybeSingle<{ reason?: string | null }>();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

async function getDuplicateCreatorModuleSubmission(discordId: string, sourceCode: string, moduleId: string) {
    const { data, error } = await supabase
        .from('addon_modules')
        .select('id, name, status, source_code, source_checksum')
        .eq('author_discord_id', discordId)
        .neq('id', moduleId)
        .in('status', ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'])
        .order('updated_at', { ascending: false })
        .limit(50);

    if (error) {
        throw new Error(error.message);
    }

    return findDuplicateAddonModuleSubmission(
        sourceCode,
        (data || []) as Array<{
            id?: string | null;
            name?: string | null;
            status?: string | null;
            source_code?: string | null;
            source_checksum?: string | null;
        }>,
    );
}

function blockedCreatorResponse(block: { reason?: string | null }) {
    return NextResponse.json({
        error: block.reason
            ? `You are blocked from updating modules. Reason: ${trimModuleString(block.reason, 500)}`
            : 'You are blocked from updating modules.',
    }, { status: 403 });
}

export async function GET(_req: Request, context: RouteContext) {
    const auth = await requireCreator();
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const { data, error } = await supabase
        .from('addon_modules')
        .select('*')
        .eq('id', id)
        .eq('author_discord_id', auth.userId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();
    const [labeledModule] = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels([data as Record<string, unknown>], staffDiscordIds),
    );

    return NextResponse.json(normalizeAddonModule(labeledModule, true));
}

export async function PATCH(req: Request, context: RouteContext) {
    const auth = await requireCreator();
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const requestedStatus = getCreatorWritableStatus(body.status);
    if ('status' in body && !requestedStatus) {
        return NextResponse.json({ error: 'Creators can only save drafts, submit for review, or archive modules.' }, { status: 400 });
    }

    if (requestedStatus !== 'ARCHIVED') {
        let block: { reason?: string | null } | null = null;
        try {
            block = await getActiveCreatorBlock(auth.userId);
        } catch (error) {
            return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check creator access.' }, { status: 500 });
        }

        if (block) {
            return blockedCreatorResponse(block);
        }
    }

    const sanitized = sanitizeAddonModuleInput(body, true);
    if ('errors' in sanitized) {
        return NextResponse.json({ error: sanitized.errors.join(' ') }, { status: 400 });
    }

    const { data: existingModule, error: existingModuleError } = await supabase
        .from('addon_modules')
        .select('id, name, slug, status, source_code')
        .eq('id', id)
        .eq('author_discord_id', auth.userId)
        .maybeSingle<{ id: string; name?: string | null; slug?: string | null; status?: string | null; source_code?: string | null }>();

    if (existingModuleError) {
        return NextResponse.json({ error: existingModuleError.message }, { status: 500 });
    }

    if (!existingModule) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const input = sanitized.input;
    if (input.sourceCode !== undefined && input.sourceCode !== String(existingModule.source_code || '')) {
        try {
            const duplicateSubmission = await getDuplicateCreatorModuleSubmission(auth.userId, input.sourceCode, id);
            if (duplicateSubmission) {
                const duplicateType = duplicateSubmission.reason === 'exact_source' ? 'same' : 'very similar';
                return NextResponse.json({
                    error: `This looks like the ${duplicateType} module as "${duplicateSubmission.name}". Update that submission instead of duplicating it.`,
                    duplicateModule: {
                        id: duplicateSubmission.id,
                        name: duplicateSubmission.name,
                        status: duplicateSubmission.status,
                        similarity: duplicateSubmission.similarity,
                    },
                }, { status: 409 });
            }
        } catch (error) {
            return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check for duplicate module submissions.' }, { status: 500 });
        }
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
        updated_at: now,
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.version !== undefined) updates.version = input.version;
    if (input.category !== undefined) updates.category = input.category;
    if (input.sourceCode !== undefined) {
        updates.source_code = input.sourceCode;
        updates.source_checksum = checksumModuleSource(input.sourceCode);
        updates.config_schema = input.configSchema || {};
    }
    if (input.slug !== undefined || input.name !== undefined) {
        updates.slug = await buildUniqueSlug(input.slug || input.name || existingModule.name || 'module', id);
    }

    if (requestedStatus) {
        updates.status = requestedStatus;
        if (requestedStatus === 'PENDING_REVIEW') {
            updates.submitted_at = now;
            updates.reviewed_at = null;
            updates.reviewed_by_discord_id = null;
            updates.moderation_note = '';
            updates.published_at = null;
        } else if (requestedStatus === 'DRAFT') {
            updates.reviewed_at = null;
            updates.reviewed_by_discord_id = null;
            updates.published_at = null;
        } else if (requestedStatus === 'ARCHIVED') {
            updates.published_at = null;
        }
    }

    const { data, error } = await supabase
        .from('addon_modules')
        .update(updates)
        .eq('id', id)
        .eq('author_discord_id', auth.userId)
        .select('*')
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    if (requestedStatus === 'ARCHIVED') {
        const { error: installCleanupError } = await supabase
            .from('server_addon_modules')
            .delete()
            .eq('module_id', id);

        if (installCleanupError) {
            return NextResponse.json({ error: installCleanupError.message }, { status: 500 });
        }
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();
    const [labeledModule] = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels([data as Record<string, unknown>], staffDiscordIds),
    );

    return NextResponse.json({ module: normalizeAddonModule(labeledModule, true) });
}

export async function DELETE(_req: Request, context: RouteContext) {
    const auth = await requireCreator();
    if ('error' in auth) return auth.error;

    const { id } = await context.params;
    const { error } = await supabase
        .from('addon_modules')
        .delete()
        .eq('id', id)
        .eq('author_discord_id', auth.userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
