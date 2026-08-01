import { createSeoMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data } = await supabase
        .from('job_applications')
        .select('title, description')
        .eq('id', id)
        .eq('status', 'OPEN')
        .maybeSingle<{ title?: string | null; description?: string | null }>();
    const jobTitle = data?.title?.trim() || 'Career Opportunity';
    const description = data?.description?.trim() || `Apply for ${jobTitle} with Ro-Link.`;

    return createSeoMetadata({ title: `${jobTitle} Career`, description, path: `/careers/${encodeURIComponent(id)}` });
}

export default function CareerLayout({ children }: { children: React.ReactNode }) { return children; }
