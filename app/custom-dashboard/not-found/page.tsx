type PageProps = {
    searchParams: Promise<{ subdomain?: string }>;
};

export default async function CustomDashboardNotFoundPage({ searchParams }: PageProps) {
    const { subdomain } = await searchParams;

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-white">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/30">
                <img src="/Media/Ro-LinkIcon.png" alt="" className="mx-auto mb-5 h-12 w-12 rounded-xl" />
                <h1 className="text-2xl font-bold tracking-tight">Dashboard not found</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                    {subdomain
                        ? `No custom dashboard is configured for ${subdomain}.`
                        : 'No custom dashboard is configured for this address.'}
                </p>
            </div>
        </div>
    );
}

