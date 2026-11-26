import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createModuleReviewHandlers, type ReviewSession } from '@/lib/moduleReviewApi';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { listVisibleGuildsForDiscordSession } from '@/lib/dashboardGuilds';
import { resolveDashboardUserPermissions } from '@/lib/gameAdmin';

export const dynamic = 'force-dynamic';
const handlers = createModuleReviewHandlers({
    session: async () => await getServerSession(authOptions) as ReviewSession | null,
    db: getSupabaseAdmin,
    configured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    visibleGuildIds: async session => (await listVisibleGuildsForDiscordSession(session.accessToken!, session.user!.id!)).filter(guild => guild.hasBot).map(guild => guild.id),
    canManage: async (serverId, discordId) => {
        const permissions = await resolveDashboardUserPermissions(serverId, discordId);
        return permissions.is_admin || permissions.can_manage_settings;
    },
});
type Context = { params: Promise<{ moduleId: string }> };
export async function GET(request: Request, context: Context) { return handlers.GET(request, (await context.params).moduleId); }
export async function POST(request: Request, context: Context) { return handlers.POST(request, (await context.params).moduleId); }
export async function DELETE(request: Request, context: Context) { return handlers.DELETE(request, (await context.params).moduleId); }
