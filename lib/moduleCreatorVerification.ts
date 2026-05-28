import { supabase } from '@/lib/supabase';

export const VERIFIED_CREATOR_APPROVED_MODULE_THRESHOLD = 20;
export const VERIFIED_CREATOR_MODULE_INSTALL_THRESHOLD = 50;

export interface ModuleCreatorVerificationStats {
    approvedModuleCount: number;
    maxModuleInstallCount: number;
    isVerifiedCreator: boolean;
}

function emptyCreatorStats(): ModuleCreatorVerificationStats {
    return {
        approvedModuleCount: 0,
        maxModuleInstallCount: 0,
        isVerifiedCreator: false,
    };
}

export async function getModuleCreatorVerificationStats(authorDiscordIds: string[]) {
    const uniqueAuthorIds = Array.from(new Set(authorDiscordIds.filter(Boolean)));
    const statsByAuthor = new Map<string, ModuleCreatorVerificationStats>();

    for (const authorId of uniqueAuthorIds) {
        statsByAuthor.set(authorId, emptyCreatorStats());
    }

    if (uniqueAuthorIds.length === 0) {
        return statsByAuthor;
    }

    const { data: approvedModules, error: approvedError } = await supabase
        .from('addon_modules')
        .select('id, author_discord_id')
        .in('author_discord_id', uniqueAuthorIds)
        .eq('status', 'PUBLISHED');

    if (approvedError) {
        throw new Error(approvedError.message);
    }

    const moduleAuthorById = new Map<string, string>();
    for (const row of approvedModules || []) {
        const moduleId = String((row as { id?: string }).id || '');
        const authorDiscordId = String((row as { author_discord_id?: string }).author_discord_id || '');
        if (!moduleId || !authorDiscordId) continue;

        moduleAuthorById.set(moduleId, authorDiscordId);
        const currentStats = statsByAuthor.get(authorDiscordId) || emptyCreatorStats();
        currentStats.approvedModuleCount += 1;
        statsByAuthor.set(authorDiscordId, currentStats);
    }

    const approvedModuleIds = Array.from(moduleAuthorById.keys());
    if (approvedModuleIds.length > 0) {
        const { data: installedModules, error: installedError } = await supabase
            .from('server_addon_modules')
            .select('module_id')
            .in('module_id', approvedModuleIds);

        if (installedError) {
            throw new Error(installedError.message);
        }

        const installCountByModule = new Map<string, number>();
        for (const row of installedModules || []) {
            const moduleId = String((row as { module_id?: string }).module_id || '');
            if (!moduleId) continue;
            installCountByModule.set(moduleId, (installCountByModule.get(moduleId) || 0) + 1);
        }

        for (const [moduleId, installCount] of installCountByModule) {
            const authorDiscordId = moduleAuthorById.get(moduleId);
            if (!authorDiscordId) continue;

            const currentStats = statsByAuthor.get(authorDiscordId) || emptyCreatorStats();
            currentStats.maxModuleInstallCount = Math.max(currentStats.maxModuleInstallCount, installCount);
            statsByAuthor.set(authorDiscordId, currentStats);
        }
    }

    for (const [authorDiscordId, stats] of statsByAuthor) {
        stats.isVerifiedCreator = stats.approvedModuleCount >= VERIFIED_CREATOR_APPROVED_MODULE_THRESHOLD
            || stats.maxModuleInstallCount >= VERIFIED_CREATOR_MODULE_INSTALL_THRESHOLD;
        statsByAuthor.set(authorDiscordId, stats);
    }

    return statsByAuthor;
}

export async function applyVerifiedCreatorBadges(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const statsByAuthor = await getModuleCreatorVerificationStats(
        rows.map((row) => String(row.author_discord_id || '')),
    );

    return rows.map((row) => {
        const authorDiscordId = String(row.author_discord_id || '');
        const stats = authorDiscordId ? statsByAuthor.get(authorDiscordId) : null;

        return {
            ...row,
            is_verified_creator: stats?.isVerifiedCreator === true,
            creator_approved_module_count: stats?.approvedModuleCount || 0,
            creator_max_module_install_count: stats?.maxModuleInstallCount || 0,
        };
    });
}
