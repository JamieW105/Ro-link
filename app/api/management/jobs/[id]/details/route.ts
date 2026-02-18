import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_JOB_APPLICATION'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: job, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(job);
}
