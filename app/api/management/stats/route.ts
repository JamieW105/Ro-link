import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'RO_LINK_DASHBOARD'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const [
            { count: totalServers },
            { count: activeApplications },
            { count: totalSubmissions },
            { count: blockedServers }
        ] = await Promise.all([
            supabase.from('servers').select('*', { count: 'exact', head: true }),
            supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
            supabase.from('job_submissions').select('*', { count: 'exact', head: true }),
            supabase.from('blocked_servers').select('*', { count: 'exact', head: true })
        ]);

        return NextResponse.json({
            totalServers: totalServers || 0,
            activeApplications: activeApplications || 0,
            totalSubmissions: totalSubmissions || 0,
            blockedServers: blockedServers || 0
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
