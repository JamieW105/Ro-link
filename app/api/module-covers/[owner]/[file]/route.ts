import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createModuleCoverReadHandler } from '@/lib/moduleCoverServer';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const read = createModuleCoverReadHandler({
    session: async () => await getServerSession(authOptions),
    db: getSupabaseAdmin,
    configured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
});
export async function GET(_request: Request, context: { params: Promise<{ owner: string; file: string }> }) {
    const { owner, file } = await context.params;
    return read(`${owner}/${file}`);
}
