import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('plugin_sessions')
            .select('status, token')
            .eq('session_id', sessionId)
            .single();

        if (error || !data) {
            return NextResponse.json({ status: 'pending' });
        }

        if (data.status === 'approved' && data.token) {
            return NextResponse.json({ token: data.token });
        }

        return NextResponse.json({ status: data.status });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
