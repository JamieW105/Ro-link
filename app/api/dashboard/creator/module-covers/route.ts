import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createModuleCoverUploadHandler } from '@/lib/moduleCoverServer';
export const runtime = 'nodejs';
export const POST = createModuleCoverUploadHandler({
    session: async () => await getServerSession(authOptions),
    db: getSupabaseAdmin,
    configured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
});
