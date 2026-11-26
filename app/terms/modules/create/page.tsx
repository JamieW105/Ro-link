import Link from 'next/link';

export default function ModuleCreatorTermsPage() {
    return (
        <div className="min-h-screen bg-background text-muted-foreground font-sans selection:bg-muted">
            <div className="mx-auto max-w-4xl px-6 py-20">
                <Link href="/dashboard/marketplace/create" className="mb-12 inline-block text-xs font-bold tracking-normal text-foreground transition-colors hover:text-foreground">
                    Back to Module Creation
                </Link>

                <h1 className="mb-4 text-3xl font-semibold tracking-tight text-foreground">Module Creator Terms</h1>
                <p className="mb-12 text-sm font-bold text-muted-foreground">Last Updated: June 18, 2026</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">1. Creator Responsibility</h2>
                        <p>By submitting a Ro-Link module, you confirm that you own or have permission to submit the code and that it complies with Roblox, Discord, and Ro-Link rules.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">2. Prohibited Modules</h2>
                        <p>Modules may not include malicious code, credential harvesting, hidden remote control, exploit tooling, NSFW content, harassment features, unauthorized data collection, obfuscated code, runtime asset loading, or code designed to bypass platform or Ro-Link safety controls.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">3. Moderation</h2>
                        <p>All submitted modules must pass moderation before public marketplace publication. Ro-Link moderators may inspect source code, request changes, deny a module, archive a module, or remove an already-published module if it violates these terms.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">4. Creator Access</h2>
                        <p>Creators may install and use their own pending modules before approval for testing. That access does not mean the module has been approved for public marketplace use.</p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-semibold tracking-normal text-foreground">5. Creator Blocks</h2>
                        <p>Creators who repeatedly submit modules that violate these terms may be blocked from creating or submitting additional modules.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
