import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const { data: server, error } = await supabase
        .from('servers')
        .select('verification_enabled, block_unverified')
        .eq('api_key', apiKey)
        .single();

    if (error || !server) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
    }

    return NextResponse.json({
        verificationEnabled: server.verification_enabled,
        blockUnverified: server.block_unverified
    });
}
