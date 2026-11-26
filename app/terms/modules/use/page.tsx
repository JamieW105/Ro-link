import Link from 'next/link';

export default function ModuleUseTermsPage() {
    return (
        <div className="min-h-screen bg-background text-muted-foreground font-sans selection:bg-muted">
            <div className="mx-auto max-w-4xl px-6 py-20">
                <Link href="/dashboard/marketplace" className="mb-12 inline-block text-xs font-bold tracking-normal text-foreground transition-colors hover:text-foreground">
                    Back to Marketplace
                </Link>

                <h1 className="mb-4 text-3xl font-semibold tracking-tight text-foreground">Module Use Terms</h1>
                <p className="mb-12 text-sm font-bold text-muted-foreground">Last Updated: May 15, 2026</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">1. User Generated Content</h2>
                        <p>Marketplace modules are user-generated content. Ro-Link reviews submissions before publication, but server owners remain responsible for choosing which modules they install and enable.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">2. Installation Risk</h2>
                        <p>Only install modules from creators you trust and review configuration carefully. Modules can affect your Ro-Link runtime, Discord messages, and Roblox admin panel behavior.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">3. Reporting Problems</h2>
                        <p>If a module appears unsafe, abusive, misleading, or broken, stop using it and report it for moderation review.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">4. Removal</h2>
                        <p>Ro-Link may remove, archive, disable, or restrict marketplace modules when needed for safety, policy enforcement, service stability, or legal compliance.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
