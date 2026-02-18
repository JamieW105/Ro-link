import { NextRequest, NextResponse } from 'next/server';
import { supabase } from "@/lib/supabase";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { data: job, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', id)
        .eq('status', 'OPEN')
        .single();

    if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(job);
}
