import Link from 'next/link';

export default function ModuleUseTermsPage() {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-sky-500/30">
            <div className="mx-auto max-w-4xl px-6 py-20">
                <Link href="/dashboard/marketplace" className="mb-12 inline-block text-xs font-bold uppercase tracking-widest text-sky-500 transition-colors hover:text-sky-400">
                    Back to Marketplace
                </Link>

                <h1 className="mb-4 text-5xl font-black uppercase italic tracking-tight text-white">Module Use Terms</h1>
                <p className="mb-12 text-sm font-bold uppercase tracking-[0.3em] text-slate-500">Last Updated: May 15, 2026</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="mb-4 border-l-4 border-sky-600 pl-4 text-xl font-bold uppercase tracking-wider text-white">1. User Generated Content</h2>
                        <p>Marketplace modules are user-generated content. Ro-Link reviews submissions before publication, but server owners remain responsible for choosing which modules they install and enable.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 border-l-4 border-sky-600 pl-4 text-xl font-bold uppercase tracking-wider text-white">2. Installation Risk</h2>
                        <p>Only install modules from creators you trust and review configuration carefully. Modules can affect your Ro-Link runtime, Discord messages, and Roblox admin panel behavior.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 border-l-4 border-sky-600 pl-4 text-xl font-bold uppercase tracking-wider text-white">3. Reporting Problems</h2>
                        <p>If a module appears unsafe, abusive, misleading, or broken, stop using it and report it for moderation review.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 border-l-4 border-sky-600 pl-4 text-xl font-bold uppercase tracking-wider text-white">4. Removal</h2>
                        <p>Ro-Link may remove, archive, disable, or restrict marketplace modules when needed for safety, policy enforcement, service stability, or legal compliance.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
