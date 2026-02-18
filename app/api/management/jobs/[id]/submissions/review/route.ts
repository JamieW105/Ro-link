import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function PATCH(
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

    const { submissionId, status, reason } = await req.json();

    const { data: sub, error } = await supabase
        .from('job_submissions')
        .update({
            status,
            review_reason: reason,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select(`
            *,
            job:job_applications(title)
        `)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // DM the user with the result (Using DISCORD_TOKEN)
    const botToken = process.env.DISCORD_TOKEN;
    if (botToken) {
        try {
            const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_id: sub.discord_id })
            });
            const dmChannel = await dmChannelRes.json();

            if (dmChannel.id) {
                await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: `Application Update: ${status}`,
                            description: `Your application for **${(sub.job as any).title}** has been **${status.toLowerCase()}**.`,
                            color: status === 'ACCEPTED' ? 0x10b981 : 0xef4444,
                            fields: [
                                { name: 'Reason / Feedback', value: reason || 'No specific feedback provided.' }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    })
                });
            }
        } catch (dmErr) {
            console.error("Failed to send status update DM:", dmErr);
        }
    }

    return NextResponse.json(sub);
}
