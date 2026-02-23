import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: Request,
    { params }: { params: { gameId: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        const gameId = params.gameId;

        // Verify token here (simplified)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        const { data, error } = await supabase
            .from('games_configuration')
            .select('api_key')
            .eq('game_id', gameId)
            .single();

        if (error || !data) {
            return NextResponse.json({
                configured: false,
                setupUrl: `${protocol}://${host}/dashboard/game-setup/${gameId}`
            });
        }

        return NextResponse.json({ configured: true, apiKey: data.api_key });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
