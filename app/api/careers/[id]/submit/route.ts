import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabase } from "@/lib/supabase";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: applicationId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const { answers } = await req.json();

    try {
        // 1. Check if already submitted
        const { data: existing } = await supabase
            .from('job_submissions')
            .select('id')
            .eq('application_id', applicationId)
            .eq('discord_id', userId)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'You have already submitted an application for this position.' }, { status: 400 });
        }

        // 2. Get Job Info for DM and verification
        const { data: job } = await supabase
            .from('job_applications')
            .select('title, status, questions')
            .eq('id', applicationId)
            .single();

        if (!job || job.status !== 'OPEN') {
            return NextResponse.json({ error: 'This application is no longer open.' }, { status: 400 });
        }

        // 3. Save Submission
        const { error: subError } = await supabase
            .from('job_submissions')
            .insert({
                application_id: applicationId,
                discord_id: userId,
                answers: answers,
                status: 'PENDING'
            });

        if (subError) throw subError;

        // 4. DM the user (Using DISCORD_TOKEN which is the standard in this repo)
        const botToken = process.env.DISCORD_TOKEN;
        if (botToken) {
            try {
                // Create DM channel
                const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_id: userId })
                });

                if (!dmChannelRes.ok) {
                    const error = await dmChannelRes.json();
                    console.error("Discord API Error (DM Channel):", error);
                } else {
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
                                        { name: 'Wait Time', value: 'Our team will review your application soon.' },
                                        { name: 'Note', value: 'Ensure your DMs stay open to receive updates.' }
                                    ],
                                    timestamp: new Date().toISOString()
                                }]
                            })
                        });

                        // Embed 2: Answers Summary
                        const qAndA = (job.questions as any[]).map((q: any) => {
                            if (q.type === 'section') return null;
                            const answer = answers[q.id];
                            return {
                                name: q.label,
                                value: String(answer || 'N/A').substring(0, 1024)
                            };
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
                }
            } catch (dmErr) {
                console.error("Failed to send DM:", dmErr);
            }
        } else {
            console.warn("DISCORD_TOKEN not found in environment variables.");
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
