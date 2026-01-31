import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    try {
        // 1. Search for user (Case-insensitive, finds closest match)
        const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${username}&limit=1`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!searchRes.ok) {
            const errorText = await searchRes.text();
            console.error('[ROBLOX API ERROR]', searchRes.status, errorText);
            return NextResponse.json({ error: `Roblox API Error (${searchRes.status})` }, { status: searchRes.status });
        }

        const searchData = await searchRes.json();
        if (!searchData.data || searchData.data.length === 0) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const userId = searchData.data[0].id;

        // 2. Get Detailed Profile
        const profileRes = await fetch('https://users.roblox.com/v1/users/' + userId);
        const profileData = await profileRes.json();

        // 3. Get Avatar Thumbnail
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const thumbData = await thumbRes.json();
        const avatarUrl = thumbData.data?.[0]?.imageUrl || '';

        return NextResponse.json({
            id: userId,
            username: profileData.name,
            displayName: profileData.displayName,
            description: profileData.description,
            created: profileData.created,
            isBanned: profileData.isBanned,
            avatarUrl
        });

        return NextResponse.json({
            id: userId,
            username: profileData.name,
            displayName: profileData.displayName,
            description: profileData.description,
            created: profileData.created,
            isBanned: profileData.isBanned,
            avatarUrl
        });

    } catch (error) {
        console.error('Roblox Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to fetch Roblox data' }, { status: 500 });
    }
}
