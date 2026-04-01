import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    return NextResponse.json(
        {
            ok: true,
            timestamp: Date.now(),
        },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
            },
        },
    );
}
