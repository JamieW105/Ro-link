import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const serverId = searchParams.get('serverId');

    if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Fetch User's Open Cloud Key
    let apiKey = null;
    if (serverId) {
        const { data: server } = await supabase
            .from('servers')
            .select('open_cloud_key')
            .eq('id', serverId)
            .single();
        apiKey = server?.open_cloud_key;
    }

    try {
        // 1. Search for user (Legacy Search does NOT support x-api-key)
        const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${username}&limit=10`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!searchRes.ok) {
            if (searchRes.status === 429) {
                return NextResponse.json({ error: 'Roblox Rate Limit reached.' }, { status: 429 });
            }
            return NextResponse.json({ error: `Roblox Search Error (${searchRes.status})` }, { status: searchRes.status });
        }

        const searchData = await searchRes.json();
        if (!searchData.data || searchData.data.length === 0) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const userId = searchData.data[0].id;

        // 2. Get Detailed Profile (Use Cloud v2 if API key is available)
        let profileData;
        if (apiKey) {
            const cloudRes = await fetch(`https://apis.roblox.com/cloud/v2/users/${userId}`, {
                headers: { 'x-api-key': apiKey }
            });
            if (cloudRes.ok) {
                profileData = await cloudRes.json();
                // Map Cloud v2 fields to legacy fields for frontend compatibility
                profileData.name = profileData.name.split('/').pop(); // "users/123" -> "123"
                profileData.displayName = profileData.displayName;
            }
        }

        if (!profileData) {
            const legacyProfileRes = await fetch('https://users.roblox.com/v1/users/' + userId);
            profileData = await legacyProfileRes.json();
        }

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
