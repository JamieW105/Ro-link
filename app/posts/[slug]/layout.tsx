import { createSeoMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { data } = await supabase
        .from('update_posts')
        .select('title, description')
        .eq('slug', slug)
        .eq('status', 'PUBLISHED')
        .not('published_at', 'is', null)
        .maybeSingle<{ title?: string | null; description?: string | null }>();
    const postTitle = data?.title?.trim() || 'Product Update';
    const description = data?.description?.trim() || 'Read this product update from Ro-Link.';

    return createSeoMetadata({ title: postTitle, description, path: `/posts/${encodeURIComponent(slug)}` });
}

export default function UpdatePostLayout({ children }: { children: React.ReactNode }) { return children; }
