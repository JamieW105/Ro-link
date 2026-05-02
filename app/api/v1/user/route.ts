
import { NextResponse } from 'next/server';
import { describeServerApiKeyDetails, readServerApiKeyDetails } from '@/lib/serverApiKey';
import { findServerByKeyWithDiagnostics } from '@/lib/serverAuth';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    // Heartbeat check (Allow check without API key)
    // If no username is provided, or status=check, or it's Better Uptime, return 200
    if (!username || searchParams.get('status') === 'check' || req.headers.get('user-agent')?.includes('Better Uptime')) {
        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for player lookup'
        }, { status: 200 });
    }

    const auth = readServerApiKeyDetails(req);
    const authDebug = describeServerApiKeyDetails(auth);
    if (!auth.key) {
        console.warn('[RoLinkAPI][User] Missing API key', { auth: authDebug });
        return NextResponse.json({
            error: 'Missing API Key',
            code: 'missing_api_key',
            message: 'No server key was provided. Send x-api-key or Authorization: Bearer <key>.',
            auth: authDebug,
        }, { status: 401 });
    }

    const lookup = await findServerByKeyWithDiagnostics<{ id: string }>('id', auth.key);
    const server = lookup.server;

    if (!server) {
        console.warn('[RoLinkAPI][User] Invalid API key', {
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

    try {
        // Reuse proxy logic but authenticated
        const searchRes = await fetch('https://users.roproxy.com/v1/usernames/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        const searchData = await searchRes.json();
        const user = searchData.data?.[0];

        if (!user) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        return NextResponse.json(user);

    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
