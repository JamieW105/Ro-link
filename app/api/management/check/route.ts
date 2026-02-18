import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getManagementUser } from "@/lib/management";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json({ permissions: [] }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await getManagementUser(userId);

    if (!user) {
        return NextResponse.json({ permissions: [] });
    }

    // @ts-ignore
    const permissions = user.role?.permissions || [];
    return NextResponse.json({ permissions });
}
