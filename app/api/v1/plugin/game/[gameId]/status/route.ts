import { NextResponse } from 'next/server';
import { pluginStore } from '../../../store';

export async function GET(
    request: Request,
    { params }: { params: { gameId: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        const gameId = params.gameId;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        const gameConfig = pluginStore.games.get(gameId);

        if (!gameConfig) {
            return NextResponse.json({
                configured: false,
                setupUrl: `${protocol}://${host}/dashboard/game-setup/${gameId}`
            });
        }

        return NextResponse.json({ configured: true, apiKey: gameConfig.api_key });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    return NextResponse.json({}, { headers: { 'Allow': 'GET, OPTIONS' } });
}
