import { NextResponse } from 'next/server';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';

export async function GET(req: Request) {
    const auth = readServerApiKeyDetails(req);
    const authDebug = describeServerApiKeyDetails(auth);

    if (!auth.key) {
        console.warn('[RoLinkAPI][Settings] Missing API key', { auth: authDebug });
        return NextResponse.json({
            error: 'Missing API Key',
            code: 'missing_api_key',
            message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
            auth: authDebug,
        }, { status: 401 });
    }

    const lookup = await findServerByKeyWithDiagnostics<{
        verification_enabled: boolean | null;
        block_unverified: boolean | null;
        admin_cmds_enabled: boolean | null;
        misc_cmds_enabled: boolean | null;
        enforce_moderation_role_hierarchy: boolean | null;
    }>(
        'verification_enabled, block_unverified, admin_cmds_enabled, misc_cmds_enabled, enforce_moderation_role_hierarchy',
        auth.key,
    );
    const server = lookup.server;

    if (!server) {
        console.warn('[RoLinkAPI][Settings] Invalid API key', {
            auth: authDebug,
            lookupError: lookup.error,
        });
        return NextResponse.json({
            error: 'Invalid API Key',
            code: 'invalid_api_key',
            message: 'The provided server key did not match any server record.',
            auth: authDebug,
            lookup: {
                matchedBy: lookup.matchedBy,
                error: lookup.error,
            },
        }, { status: 403 });
    }

    return NextResponse.json({
        verificationEnabled: server.verification_enabled,
        blockUnverified: server.block_unverified,
        adminCmdsEnabled: server.admin_cmds_enabled !== false,
        miscCmdsEnabled: server.misc_cmds_enabled !== false,
        enforceModerationRoleHierarchy: server.enforce_moderation_role_hierarchy !== false,
    });
}
