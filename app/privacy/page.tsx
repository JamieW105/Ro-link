'use client';

import Link from 'next/link';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-sky-500/30">
            <div className="max-w-4xl mx-auto px-6 py-20">
                <Link href="/" className="text-sky-500 font-bold text-xs uppercase tracking-widest hover:text-sky-400 transition-colors mb-12 inline-block">
                    ← Back to Home
                </Link>

                <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase italic">Privacy Policy</h1>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.3em] mb-12">Effective Date: February 13, 2026</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">1. Information We Collect</h2>
                        <div className="space-y-4">
                            <p>To provide our services, we collect and store limited information from Discord and Roblox via their official OAuth2 systems:</p>
                            <ul className="list-disc list-inside space-y-2 pl-4 text-slate-400">
                                <li><b>Discord Information:</b> User ID, Username, and Avatar hash.</li>
                                <li><b>Roblox Information:</b> User ID and Username.</li>
                                <li><b>Server Information:</b> Guild IDs, Role IDs, and configuration settings provided by server administrators.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">2. How We Use Data</h2>
                        <p>Information is used solely to facilitate the linking of accounts and the synchronization of roles across Discord servers. We do not sell, trade, or distribute your personal information to third parties.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">3. Data Security</h2>
                        <p>We implement industry-standard security measures to protect your information. API keys are stored with encryption, and authentication is handled through the official Discord and Roblox secure gateways.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">4. Third-Party Services</h2>
                        <p>Our service interacts with Discord and Roblox APIs. Please refer to their respective privacy policies to understand how they handle your data on their platforms.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-sky-600 pl-4">5. Data Deletion</h2>
                        <p>Users may request the deletion of their linked data at any time by contacting our support team or unlinking their accounts through the Ro-Link dashboard. Deleting our bot from your server will also cease collection of server-specific data.</p>
                    </section>
                </div>

                <footer className="mt-20 pt-10 border-t border-slate-800 text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center">
                    &copy; 2026 Ro-Link Global Integration &bull; Contact: support@rolink.cloud
                </footer>
            </div>
        </div>
    );
}
