import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { listVisibleGuildsForDiscordSession } from '@/lib/dashboardGuilds';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';
import {
    MAX_SERVER_ADDON_MODULES,
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

type SessionWithDiscord = Awaited<ReturnType<typeof getServerSession>> & {
    accessToken?: string;
    user?: {
        id?: string;
    };
};

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

export async function GET() {
    const session = await getServerSession(authOptions) as SessionWithDiscord | null;
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String((session.user as { id?: string }).id || '');
    const query = supabase
        .from('addon_modules')
        .select('id, slug, name, description, version, category, status, source_checksum, config_schema, author_discord_id, submitted_at, reviewed_at, reviewed_by_discord_id, moderation_note, created_at, updated_at, published_at')
        .order('name', { ascending: true });

    const { data, error } = userId
        ? await query.or(`status.eq.PUBLISHED,author_discord_id.eq.${userId}`)
        : await query.eq('status', 'PUBLISHED');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();
    let installTargets: Array<{ id: string; name: string; icon: string | null; installedModuleCount: number; moduleLimit: number }> = [];

    if (session.accessToken && userId) {
        try {
            const visibleGuilds = await listVisibleGuildsForDiscordSession(session.accessToken, userId);
            const guildChecks = visibleGuilds
                .filter((guild) => guild.hasBot)
                .map(async (guild) => {
                    try {
                        const permissions = await resolveDashboardUserPermissions(guild.id, userId);
                        if (!permissions.is_admin && !permissions.can_manage_settings) {
                            return null;
                        }

                        return {
                            id: guild.id,
                            name: guild.name,
                            icon: guild.icon || null,
                        };
                    } catch {
                        return null;
                    }
                });

            const checkedGuilds = await Promise.all(guildChecks);
            const manageableGuilds = checkedGuilds
                .filter((guild): guild is { id: string; name: string; icon: string | null } => Boolean(guild));
            const installCountsByServer = new Map<string, number>();

            if (manageableGuilds.length > 0) {
                const { data: installedRows, error: installedError } = await supabase
                    .from('server_addon_modules')
                    .select('server_id')
                    .in('server_id', manageableGuilds.map((guild) => guild.id));

                if (installedError) {
                    throw new Error(installedError.message);
                }

                for (const row of installedRows || []) {
                    const targetServerId = String((row as { server_id?: string }).server_id || '');
                    installCountsByServer.set(targetServerId, (installCountsByServer.get(targetServerId) || 0) + 1);
                }
            }

            installTargets = manageableGuilds
                .map((guild) => ({
                    ...guild,
                    installedModuleCount: installCountsByServer.get(guild.id) || 0,
                    moduleLimit: MAX_SERVER_ADDON_MODULES,
                }))
                .sort((first, second) => first.name.localeCompare(second.name));
        } catch (error) {
            console.warn('[Marketplace] Failed to load module install targets.', error);
        }
    }

    const labeledModules = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels((data || []) as Record<string, unknown>[], staffDiscordIds),
    );

    return NextResponse.json({
        modules: labeledModules
            .map((row) => normalizeAddonModule(row, false))
            .filter(Boolean),
        installTargets,
    });
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String((session.user as { id?: string }).id || '');
    if (!userId) {
        return NextResponse.json({ error: 'Discord user ID is required.' }, { status: 400 });
    }

    let block: { reason?: string | null } | null = null;
    try {
        block = await getActiveCreatorBlock(userId);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check creator access.' }, { status: 500 });
    }

    if (block) {
        return NextResponse.json({
            error: block.reason
                ? `You are blocked from creating modules. Reason: ${trimModuleString(block.reason, 500)}`
                : 'You are blocked from creating modules.',
        }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeAddonModuleInput(body);
    if ('errors' in sanitized) {
        return NextResponse.json({ error: sanitized.errors.join(' ') }, { status: 400 });
    }

    const input = sanitized.input;
    try {
        const duplicateSubmission = await getDuplicateCreatorModuleSubmission(userId, input.sourceCode || '');
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
            status: 'PENDING_REVIEW',
            source_code: input.sourceCode,
            source_checksum: checksumModuleSource(input.sourceCode || ''),
            config_schema: input.configSchema || {},
            author_discord_id: userId,
            submitted_at: now,
            moderation_note: '',
            updated_at: now,
            published_at: null,
        })
        .select('id, slug, name, description, version, category, status, source_checksum, config_schema, author_discord_id, submitted_at, reviewed_at, reviewed_by_discord_id, moderation_note, created_at, updated_at, published_at')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffDiscordIds = await getRoLinkStaffDiscordIds();
    const [labeledModule] = await applyVerifiedCreatorBadges(
        applyOfficialModuleLabels([data as Record<string, unknown>], staffDiscordIds),
    );

    return NextResponse.json({ module: normalizeAddonModule(labeledModule, false) }, { status: 201 });
}
