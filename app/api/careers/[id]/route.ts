import { NextRequest, NextResponse } from 'next/server';
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    // 1. Fetch Job
    const { data: job, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', id)
        .eq('status', 'OPEN')
        .single();

    if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 2. Check if user already submitted
    let hasSubmitted = false;
    if (session?.user) {
        const userId = (session.user as any).id;
        const { data: existing } = await supabase
            .from('job_submissions')
            .select('id')
            .eq('application_id', id)
            .eq('discord_id', userId)
            .single();

        if (existing) hasSubmitted = true;
    }

    return NextResponse.json({ ...job, hasSubmitted });
}
