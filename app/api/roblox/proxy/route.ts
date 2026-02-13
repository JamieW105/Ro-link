import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({
            status: 'API Active',
            message: 'Ready for Roblox profile proxy'
        }, { status: 200 });
    }

    try {
        // 1. Get User ID from Username (Exact Match)
        const searchRes = await fetch('https://users.roproxy.com/v1/usernames/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        const searchData = await searchRes.json();
        console.log(`[PROXY] Search result for ${username}:`, JSON.stringify(searchData));

        if (!searchData.data || searchData.data.length === 0) {
            console.log(`[PROXY] No user found for: ${username}`);
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const user = searchData.data[0];
        const userId = user.id;

        // 2. Get Detailed Profile
        const profileRes = await fetch('https://users.roproxy.com/v1/users/' + userId);
        const profileData = await profileRes.json();

        // 3. Get Avatar Thumbnail (Headshot)
        const thumbRes = await fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
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

    } catch (error) {
        console.error('Roblox Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to fetch Roblox data' }, { status: 500 });
    }
}
