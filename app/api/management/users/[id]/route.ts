import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";
import { supabase } from "@/lib/supabase";

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    if (!(await hasPermission(userId, 'MANAGE_RO_LINK'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (params.id === '953414442060746854') {
        return NextResponse.json({ error: 'Cannot remove the primary owner.' }, { status: 400 });
    }

    const { error } = await supabase
        .from('management_users')
        .delete()
        .eq('discord_id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
