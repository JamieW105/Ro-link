import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ verified: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];

        const { data, error } = await supabase
            .from('plugin_sessions')
            .select('status')
            .eq('token', token)
            .single();

        if (error || !data || data.status !== 'approved') {
            return NextResponse.json({ verified: false, error: 'Invalid token' }, { status: 401 });
        }

        // Role check for "Plugin access" logic goes here
        return NextResponse.json({ verified: true, hasPermission: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
