import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_JOB_APPLICATION'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch jobs with submission counts
    const { data: jobs, error } = await supabase
        .from('job_applications')
        .select(`
            *,
            submissions:job_submissions(count)
        `)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Transform to include count properly
    const transformed = jobs.map((job: any) => ({
        ...job,
        _count: {
            submissions: job.submissions?.[0]?.count || 0
        }
    }));

    return NextResponse.json(transformed);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'POST_JOB_APPLICATION'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const { data, error } = await supabase
        .from('job_applications')
        .insert({
            title: body.title,
            description: body.description,
            requirements: body.requirements,
            tags: body.tags,
            questions: body.questions,
            status: 'CLOSED'
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
