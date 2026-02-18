import { NextResponse } from 'next/server';
import { supabase } from "@/lib/supabase";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { data: job, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', params.id)
        .eq('status', 'OPEN')
        .single();

    if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(job);
}
