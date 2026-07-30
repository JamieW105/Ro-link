import { NextRequest, NextResponse } from 'next/server';
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    if (id === '__visual-preview__' || id === '__visual-submitted__') {
        return NextResponse.json({
            id,
            title: 'Community Support Specialist',
            description: 'Help community members connect their accounts and resolve setup questions.',
            requirements: 'Clear communication, patience, and familiarity with Discord and Roblox.',
            questions: [
                { id: 'intro', type: 'section', label: 'About you', required: false },
                { id: 'experience', type: 'short_answer', label: 'What relevant experience do you have?', required: true },
                { id: 'motivation', type: 'long_answer', label: 'Why do you want to join Ro-Link?', required: true },
                { id: 'availability', type: 'multi_choice', label: 'How often are you available?', required: true, options: ['Most days', 'A few days each week', 'Weekends'] },
                { id: 'terms', type: 'checkbox', label: 'Application declaration', required: true },
            ],
            hasSubmitted: id === '__visual-submitted__',
        });
    }
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
