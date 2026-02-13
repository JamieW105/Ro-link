'use client';

import Link from 'next/link';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-sky-500/30">
            <div className="max-w-4xl mx-auto px-6 py-20">
                <Link href="/" className="text-sky-500 font-bold text-xs uppercase tracking-widest hover:text-sky-400 transition-colors mb-12 inline-block">
                    ← Back to Home
                </Link>

                <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase italic">Terms of Service</h1>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.3em] mb-12">Last Updated: February 13, 2026</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">1. Acceptance of Terms</h2>
                        <p>By accessing or using Ro-Link, our Discord bot, web dashboard, or verification services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">2. Description of Service</h2>
                        <p>Ro-Link provides integration services between Roblox and Discord platforms, including but not limited to account verification, role synchronization, and server management automation.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">3. User Responsibility</h2>
                        <p>You are responsible for maintaining the security of your account credentials (including API keys and Discord login sessions). You agree not to use Ro-Link for any illegal or unauthorized purpose, including violating Roblox or Discord's respective Terms of Service.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">4. Limitations of Liability</h2>
                        <p>Ro-Link is provided "as is" without any warranties. We are not responsible for any damage, loss of data, or service interruptions caused by the use of our services, or actions taken by the Roblox or Discord platforms that may affect our functionality.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">5. Termination</h2>
                        <p>We reserve the right to terminate or suspend access to our services immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
                    </section>
                </div>

                <footer className="mt-20 pt-10 border-t border-slate-800 text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center">
                    &copy; 2026 Ro-Link Global Integration &bull; Not affiliated with Roblox or Discord
                </footer>
            </div>
        </div>
    );
}
