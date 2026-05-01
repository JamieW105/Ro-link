import { NextResponse } from 'next/server';
import { readServerApiKey } from '@/lib/serverApiKey';
import { findServerByKey } from '@/lib/serverAuth';

export async function GET(req: Request) {
    const apiKey = readServerApiKey(req);

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const server = await findServerByKey<{
        verification_enabled: boolean | null;
        block_unverified: boolean | null;
        admin_cmds_enabled: boolean | null;
        misc_cmds_enabled: boolean | null;
        enforce_moderation_role_hierarchy: boolean | null;
    }>(
        'verification_enabled, block_unverified, admin_cmds_enabled, misc_cmds_enabled, enforce_moderation_role_hierarchy',
        apiKey,
    );

    if (!server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    return NextResponse.json({
        verificationEnabled: server.verification_enabled,
        blockUnverified: server.block_unverified,
        adminCmdsEnabled: server.admin_cmds_enabled !== false,
        miscCmdsEnabled: server.misc_cmds_enabled !== false,
        enforceModerationRoleHierarchy: server.enforce_moderation_role_hierarchy !== false,
    });
}
