import { getDashboardServerName } from '@/lib/dashboardSeo';
import { createSeoMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import { normalizeCustomDashboardMetadata } from '@/lib/customDashboardSettings';

export async function generateMetadata({ params }: { params: Promise<{ serverId: string }> }) {
    const { serverId } = await params;
    const [{ data }, serverName] = await Promise.all([
        supabase.from('custom_dashboards').select('metadata').eq('server_id', serverId).maybeSingle<{ metadata?: unknown }>(),
        getDashboardServerName(serverId),
    ]);
    const customMetadata = normalizeCustomDashboardMetadata(data?.metadata);
    const brandName = customMetadata.title || serverName;
    const description = customMetadata.description || `Sign in to access the ${serverName} management dashboard powered by Ro-Link.`;

    return createSeoMetadata({
        title: `${brandName} Dashboard`,
        description,
        path: `/custom-dashboard/${encodeURIComponent(serverId)}`,
        index: false,
    });
}

export default function CustomDashboardLayout({ children }: { children: React.ReactNode }) { return children; }
