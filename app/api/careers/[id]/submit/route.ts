import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabase } from "@/lib/supabase";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const { answers } = await req.json();

    try {
        // 1. Check if already submitted
        const { data: existing } = await supabase
            .from('job_submissions')
            .select('id')
            .eq('application_id', params.id)
            .eq('discord_id', userId)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'You have already submitted an application for this position.' }, { status: 400 });
        }

        // 2. Get Job Info for DM and verification
        const { data: job } = await supabase
            .from('job_applications')
            .select('title, status, questions')
            .eq('id', params.id)
            .single();

        if (!job || job.status !== 'OPEN') {
            return NextResponse.json({ error: 'This application is no longer open.' }, { status: 400 });
        }

        // 3. Save Submission
        const { error: subError } = await supabase
            .from('job_submissions')
            .insert({
                application_id: params.id,
                discord_id: userId,
                answers: answers,
                status: 'PENDING'
            });

        if (subError) throw subError;

        // 4. DM the user
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken) {
            try {
                // Create DM channel
                const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient_id: userId })
                });
                const dmChannel = await dmChannelRes.json();

                if (dmChannel.id) {
                    // Embed 1: Confirmation
                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            embeds: [{
                                title: 'Application Received!',
                                description: `Thank you for applying for the **${job.title}** position at Ro-Link!`,
                                color: 0x0ea5e9,
                                fields: [
                                    { name: 'Status', value: 'Under Review' },
                                    { name: 'Wait Time', value: 'Your application could take up to 1 month to be read after the applications get closed.' },
                                    { name: 'Note', value: 'Please do not message staff regarding your application status.' }
                                ],
                                timestamp: new Date().toISOString()
                            }]
                        })
                    });

                    // Embed 2: Answers Summary
                    const qAndA = (job.questions as any[]).map((q: any) => {
                        if (q.type === 'section') return null;
                        return { name: q.label, value: String(answers[q.id] || 'N/A').substring(0, 1024) };
                    }).filter(Boolean);

                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            embeds: [{
                                title: 'Your Application Answers',
                                fields: qAndA,
                                color: 0x64748b
                            }]
                        })
                    });
                }
            } catch (dmErr) {
                console.error("Failed to send DM:", dmErr);
                // Don't fail the whole request if DM fails (e.g. user has DMs closed)
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
