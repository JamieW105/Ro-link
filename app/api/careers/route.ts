import { NextResponse } from 'next/server';
import { supabase } from "@/lib/supabase";

export async function GET() {
    const { data: jobs, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(jobs);
}
