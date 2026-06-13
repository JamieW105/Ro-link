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

type CreatorStatus = 'DRAFT' | 'PENDING_REVIEW';

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

function getCreatorStatus(value: unknown): CreatorStatus {
    const status = trimModuleString(value, 20).toUpperCase();
    return status === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW';
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

async function getDuplicateCreatorModuleSubmission(discordId: string, sourceCode: string) {
    const { data, error } = await supabase
        .from('addon_modules')
        .select('id, name, status, source_code, source_checksum')
        .eq('author_discord_id', discordId)
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
            ? `You are blocked from creating modules. Reason: ${trimModuleString(block.reason, 500)}`
            : 'You are blocked from creating modules.',
    }, { status: 403 });
}

export async function GET() {
    const auth = await requireCreator();
    if ('error' in auth) return auth.error;

    const { data, error } = await supabase
        .from('addon_modules')
        .select('*')
        .eq('author_discord_id', auth.userId)
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();

    const labeledModules = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels((data || []) as Record<string, unknown>[], staffDiscordIds),
    );

    return NextResponse.json({
        modules: labeledModules
            .map((row) => normalizeAddonModule(row, true))
            .filter(Boolean),
    });
}

export async function POST(req: Request) {
    const auth = await requireCreator();
    if ('error' in auth) return auth.error;

    let block: { reason?: string | null } | null = null;
    try {
        block = await getActiveCreatorBlock(auth.userId);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check creator access.' }, { status: 500 });
    }

    if (block) {
        return blockedCreatorResponse(block);
    }

    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeAddonModuleInput(body);
    if ('errors' in sanitized) {
        return NextResponse.json({ error: sanitized.errors.join(' ') }, { status: 400 });
    }

    const input = sanitized.input;
    const nextStatus = getCreatorStatus(body.status);

    try {
        const duplicateSubmission = await getDuplicateCreatorModuleSubmission(auth.userId, input.sourceCode || '');
        if (duplicateSubmission) {
            const duplicateType = duplicateSubmission.reason === 'exact_source' ? 'same' : 'very similar';
            return NextResponse.json({
                error: `This looks like the ${duplicateType} module as "${duplicateSubmission.name}". Update your existing submission instead of uploading another copy.`,
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

    const now = new Date().toISOString();
    const slug = await buildUniqueSlug(input.slug || input.name || 'module');

    const { data, error } = await supabase
        .from('addon_modules')
        .insert({
            slug,
            name: input.name,
            description: input.description || '',
            version: input.version || '1.0.0',
            category: input.category || 'General',
            status: nextStatus,
            source_code: input.sourceCode,
            source_checksum: checksumModuleSource(input.sourceCode || ''),
            config_schema: input.configSchema || {},
            author_discord_id: auth.userId,
            submitted_at: nextStatus === 'PENDING_REVIEW' ? now : null,
            reviewed_at: null,
            reviewed_by_discord_id: null,
            moderation_note: '',
            updated_at: now,
            published_at: null,
        })
        .select('*')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();
    const [labeledModule] = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels([data as Record<string, unknown>], staffDiscordIds),
    );

    return NextResponse.json({ module: normalizeAddonModule(labeledModule, true) }, { status: 201 });
}
