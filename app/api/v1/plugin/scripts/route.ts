import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const gameId = url.searchParams.get('gameId');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // This returns the required scripts directly for the plugin
        const scripts = [
            {
                name: "RoLinkCore",
                type: "Script",
                service: "ServerScriptService",
                version: "1.0.0",
                source: "-- RoLink Server Core\nprint('RoLink active');"
            },
            {
                name: "RoLinkClient",
                type: "LocalScript",
                service: "StarterPlayerScripts",
                version: "1.0.0",
                source: "-- RoLink Client Core\nprint('RoLink Client active');"
            }
        ];

        return NextResponse.json({ scripts });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
