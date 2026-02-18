import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: jobId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_JOB_APPLICATION'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: submissions, error } = await supabase
        .from('job_submissions')
        .select('*')
        .eq('application_id', jobId)
        .order('submitted_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(submissions);
}
