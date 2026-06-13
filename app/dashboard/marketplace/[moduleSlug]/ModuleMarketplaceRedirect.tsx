'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ModuleMarketplaceRedirect({ moduleSlug }: { moduleSlug: string }) {
    const router = useRouter();

    useEffect(() => {
        router.replace(`/dashboard/marketplace?module=${encodeURIComponent(moduleSlug)}`);
    }, [moduleSlug, router]);

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center px-6 text-center">
            <div>
                <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
                <p className="text-sm font-semibold text-slate-400">Opening marketplace module...</p>
            </div>
        </div>
    );
}
