'use client';

import Link from 'next/link';

import { PublicPolicyPage, PublicPolicySection } from '@/components/public/PublicPolicyPage';

const SUPPORT_URL = 'https://discord.gg/C3n4nAwYMw';

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
    return <PublicPolicySection number={number} title={title}>{children}</PublicPolicySection>;
}

export default function PrivacyPage() {
    return (
        <PublicPolicyPage
            eyebrow="Privacy"
            title="Privacy Policy"
            meta="Effective date: July 27, 2026"
            intro="How Ro-Link collects, uses, stores, and protects information across its website, Discord bot, Roblox integration, and related services."
        >
                    <Section number="1" title="Who We Are and Scope">
                        <p>Ro-Link Management Services (&ldquo;Ro-Link,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the Ro-Link website, Discord bot, dashboard, Roblox integration, APIs, plugins, and module marketplace (collectively, the &ldquo;Services&rdquo;).</p>
                        <p>This notice explains how we handle personal information when you use the Services. It does not govern Discord, Roblox, Vercel, or Supabase&apos;s independent processing; their own notices apply to their platforms.</p>
                    </Section>

                    <Section number="2" title="Information We Collect">
                        <ul className="list-disc list-inside space-y-2 pl-4 text-slate-400">
                            <li><b>Discord account and server information:</b> Discord user ID, username, avatar hash, OAuth access and refresh tokens, guild IDs, role IDs, channel IDs, and server configuration provided by administrators.</li>
                            <li><b>Roblox information:</b> Roblox user ID, username, display name, place and universe IDs, server/job IDs, and account-linking information.</li>
                            <li><b>Service and moderation data:</b> commands, action logs, reports, reasons, dashboard configuration, player-presence events, runtime diagnostics, and related metadata needed to run, secure, support, or moderate the Services.</li>
                            <li><b>Module and application content:</b> module source code, configuration, descriptions, creator identifiers, review records, and answers submitted for a job application.</li>
                            <li><b>Technical information:</b> IP address used temporarily for rate limiting, and authentication-session cookies. We do not use analytics, advertising, tracking, error-monitoring, or non-essential cookies.</li>
                        </ul>
                    </Section>

                    <Section number="3" title="How We Use Information">
                        <p>We use information to authenticate users; link Discord and Roblox accounts; provide role synchronisation, server management, moderation, module marketplace, and support features; maintain security and rate limits; investigate misuse; enforce our Terms and DGSU Policy; communicate service matters; and meet legal obligations.</p>
                        <p>We do not sell personal information or use it for targeted advertising.</p>
                    </Section>

                    <Section number="4" title="Legal Bases">
                        <p>Where a law requires a legal basis for processing, we rely on the performance of our contract with you, our legitimate interests in operating, securing, improving, and enforcing the Services, your consent where we request it, and compliance with legal obligations. We only process information for purposes consistent with the purpose for which it was collected or as otherwise permitted by applicable law.</p>
                    </Section>

                    <Section number="5" title="Cookies, IP Addresses, and Device Information">
                        <p>We use essential, HTTP-only authentication cookies to keep users signed in and help protect sessions. These cookies are not used for advertising or analytics. We temporarily use IP addresses to apply rate limits and protect our endpoints; IP/rate-limit records are not retained. We do not collect device fingerprints or device information for analytics or advertising.</p>
                    </Section>

                    <Section number="6" title="Sharing and Subprocessors">
                        <p>We share information only as needed to provide the Services, including with these service providers and platforms:</p>
                        <ul className="list-disc list-inside space-y-2 pl-4 text-slate-400">
                            <li><b>Discord</b>, for sign-in, bot operation, messages, server administration, and support.</li>
                            <li><b>Roblox</b>, for account linking, game integration, and commands or data needed by the connected experience.</li>
                            <li><b>Supabase</b>, for database and related backend services. Our production database is hosted in Singapore.</li>
                            <li><b>Vercel</b>, for website and application hosting. Our production deployment is hosted in Sydney, Australia.</li>
                        </ul>
                        <p>These providers may use their own subprocessors and may process information under their own terms and privacy notices. We may also disclose information where reasonably necessary to protect users, investigate abuse, enforce our policies, comply with law, or respond to a valid legal process.</p>
                    </Section>

                    <Section number="7" title="International Transfers and Hosting">
                        <p>Your information may be processed in New Zealand, Australia, Singapore, the United States, and other countries where Discord, Roblox, Vercel, Supabase, or their subprocessors operate. Those countries may have privacy laws that differ from the laws where you live. By using the Services, you acknowledge these international transfers. We take reasonable steps to use providers that apply appropriate security protections to the information they process for us.</p>
                    </Section>

                    <Section number="8" title="Retention">
                        <ul className="list-disc list-inside space-y-2 pl-4 text-slate-400">
                            <li>Account and account-link data are retained unless you request deletion.</li>
                            <li>Discord OAuth tokens are retained locally as part of the authenticated service session until the associated user data is deleted.</li>
                            <li>Moderation and action logs are deleted with the associated user data.</li>
                            <li>Runtime logs are deleted after 48 hours.</li>
                            <li>Support requests are retained in Discord.</li>
                            <li>Job applications are deleted after the relevant application closes.</li>
                            <li>Module content is deleted when its creator uses the delete function.</li>
                            <li>We do not maintain separate backups or retained IP/rate-limit records.</li>
                        </ul>
                        <p>We may retain limited information longer where necessary to comply with law, resolve disputes, or protect the security and integrity of the Services.</p>
                    </Section>

                    <Section number="9" title="Your Privacy Rights">
                        <p>Depending on where you live, you may have rights to ask for access to, correction of, deletion of, or restriction of the processing of your personal information; to object to certain processing; to withdraw consent; or to complain to a privacy regulator. New Zealand users may make requests under the Privacy Act 2020. United States residents, including California residents, may have additional rights under applicable state law.</p>
                        <p>Ro-Link does not provide a self-service data export. You can request access, correction, deletion, or other privacy assistance through our <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 font-bold">Support Server</a>. We may need to verify your identity before acting on a request. You may also complain to the Office of the Privacy Commissioner in New Zealand or your local privacy regulator.</p>
                    </Section>

                    <Section number="10" title="Children and Minors">
                        <p>The Services are not intended for children under 13. You must be at least 13 years old to use them. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us personal information, contact support so we can take appropriate action.</p>
                    </Section>

                    <Section number="11" title="Security and Breach Response">
                        <p>We use reasonable technical and organisational measures designed to protect information, including secure authentication flows and access controls. No system is completely secure. We assess suspected privacy breaches and will notify affected people and relevant regulators where required by applicable law, using email, dashboard notices, Discord, or another reasonable method.</p>
                    </Section>

                    <Section number="12" title="Changes and Contact">
                        <p>We may update this notice to reflect changes to our Services or legal obligations. We will post the revised version here and update the effective date.</p>
                        <p>For privacy requests, questions, or formal privacy notices, contact Ro-Link through the <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 font-bold">Ro-Link Support Server</a>.</p>
                    </Section>
        </PublicPolicyPage>
    );
}
