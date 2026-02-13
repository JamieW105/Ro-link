
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const { data: server, error: authError } = await supabase
        .from('servers')
        .select('id')
        .eq('api_key', apiKey)
        .single();

    if (authError || !server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
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

    } catch (err: any) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
