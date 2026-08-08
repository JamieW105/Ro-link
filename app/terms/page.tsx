'use client';

import Link from 'next/link';

import { PublicPolicyPage, PublicPolicySection } from '@/components/public/PublicPolicyPage';

const SUPPORT_URL = 'https://discord.gg/C3n4nAwYMw';

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
    return <PublicPolicySection number={number} title={title}>{children}</PublicPolicySection>;
}

export default function TermsPage() {
    return (
        <PublicPolicyPage
            eyebrow="Legal"
            title="Terms of Service"
            meta="Last updated: July 27, 2026"
            intro="The agreement governing your access to Ro-Link, its Discord and Roblox integrations, and related services."
        >
                    <Section number="1" title="Agreement and Provider">
                        <p>These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and Ro-Link Management Services (&ldquo;Ro-Link,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). They govern your use of the Ro-Link website, Discord bot, dashboard, Roblox integration, APIs, plugins, module marketplace, and related services (collectively, the &ldquo;Services&rdquo;).</p>
                        <p>By using the Services, inviting the bot, linking an account, connecting a server or Roblox experience, submitting a module, or otherwise accessing the Services, you agree to these Terms, our <Link href="/privacy" className="text-sky-400 hover:text-sky-300 font-bold">Privacy Policy</Link>, and our <Link href="/dgsu" className="text-sky-400 hover:text-sky-300 font-bold">DGSU Policy</Link>. If you do not agree, do not use the Services.</p>
                    </Section>

                    <Section number="2" title="Eligibility and Authority">
                        <p>You must be at least 13 years old to use the Services and must meet any higher age requirement imposed by Discord, Roblox, or applicable law. If you use the Services for a Discord server, Roblox experience, organisation, or other entity, you confirm that you have authority to accept these Terms and configure the Services on its behalf.</p>
                    </Section>

                    <Section number="3" title="The Services">
                        <p>Ro-Link provides tools that connect Discord and Roblox, including account verification, role synchronisation, server and game administration, moderation, logs, reports, APIs, plugins, and a module marketplace. Features may depend on Discord, Roblox, internet access, and third-party services outside our control.</p>
                        <p>Trusted Ro-Link staff may join servers where Ro-Link is installed when reasonably necessary for support, moderation review, diagnostics, abuse prevention, or service maintenance.</p>
                    </Section>

                    <Section number="4" title="Your Responsibilities and Restrictions">
                        <p>You are responsible for your account, Discord and Roblox credentials, API keys, connected communities, configurations, content, and everyone who uses the Services through them. Keep credentials secure and notify us promptly through support if you suspect unauthorised use.</p>
                        <p>You must not use the Services unlawfully; violate Discord&apos;s or Roblox&apos;s rules; interfere with, probe, bypass, or overload the Services; distribute malware, exploits, phishing, credential theft, or unauthorised automation; submit misleading or infringing content; collect personal information without authority; or use the Services in connection with NSFW, sexual, dangerous, abusive, deceptive, or otherwise inappropriate content or communities.</p>
                    </Section>

                    <Section number="5" title="DGSU Policy and Enforcement">
                        <p>The <Link href="/dgsu" className="text-sky-400 hover:text-sky-300 font-bold">Dangerous Game, Server, or User Policy</Link> is incorporated into these Terms. Ro-Link may investigate, restrict, suspend, remove, block, preserve evidence about, or report users, games, servers, modules, or content that violate these Terms, the DGSU Policy, platform rules, or law. We may take action without prior notice when reasonably necessary for safety, abuse prevention, security, or legal compliance.</p>
                    </Section>

                    <Section number="6" title="Customer Content and Modules">
                        <p>You retain ownership of the modules and other work you create and submit to Ro-Link. You grant Ro-Link a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, review, test, display, distribute, and otherwise use that content only as necessary to operate, secure, moderate, promote within the marketplace, and provide the Services.</p>
                        <p>You confirm that you own or have the rights needed to submit your content and grant this licence. You are responsible for your content, its configuration, and its use. Module creators and users must also comply with the <Link href="/terms/modules/create" className="text-sky-400 hover:text-sky-300 font-bold">Module Creator Terms</Link> and <Link href="/terms/modules/use" className="text-sky-400 hover:text-sky-300 font-bold">Module Use Terms</Link>.</p>
                    </Section>

                    <Section number="7" title="Ro-Link Intellectual Property and Licence">
                        <p>Ro-Link and its licensors retain all rights in the Services, including the Ro-Link name, branding, software, APIs, plugins, documentation, interfaces, and content supplied by Ro-Link. Subject to these Terms, we grant you a limited, revocable, non-exclusive, non-transferable right to use the Services for their intended purpose.</p>
                        <p>You may not copy, sell, rent, sublicense, reverse engineer, modify, or create derivative works from the Services, APIs, or plugins except where applicable law does not permit a restriction, we give written permission, or a separate open-source or written licence expressly gives you those rights. A separate licence controls to the extent it conflicts with this section. No ownership right is transferred to you.</p>
                    </Section>

                    <Section number="8" title="Changes, Availability, and Termination">
                        <p>We may add, change, suspend, remove, or discontinue any part of the Services at any time, including modules, APIs, plugins, integrations, and features. We may suspend or terminate access if we reasonably believe you have breached these Terms, created risk for users or the Services, or where required for legal compliance.</p>
                        <p>You may stop using the Services at any time. Service removal does not automatically delete all data; deletion is handled under our Privacy Policy. We do not currently provide a data-export feature.</p>
                    </Section>

                    <Section number="9" title="Fees and Third-Party Services">
                        <p>Ro-Link may offer paid features only where the applicable price, payment, renewal, cancellation, and refund terms are presented before you are charged. Unless those terms say otherwise, no paid subscription is created by using the Services.</p>
                        <p>Discord, Roblox, Vercel, Supabase, and other third parties may have separate terms, fees, or rules. We are not responsible for third-party services or changes they make.</p>
                    </Section>

                    <Section number="10" title="Confidentiality">
                        <p>Each party must use reasonable care to protect the other party&apos;s non-public confidential information, such as credentials, API keys, private configuration, and non-public module source code, and may use it only to use or provide the Services. This does not apply to information that is public without breach, independently developed, lawfully received from another source, or required to be disclosed by law. This section does not prevent Ro-Link from processing or disclosing information as described in the Privacy Policy or to enforce these Terms.</p>
                    </Section>

                    <Section number="11" title="Disclaimers and Limitation of Liability">
                        <p>The Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the fullest extent permitted by law, Ro-Link disclaims all warranties, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, non-infringement, availability, accuracy, and security. We do not guarantee uninterrupted, error-free, or secure operation, or that third-party platforms will remain compatible.</p>
                        <p>To the fullest extent permitted by law, Ro-Link will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, profits, goodwill, or business opportunity arising from or related to the Services. Nothing in these Terms excludes liability that cannot legally be excluded or limited.</p>
                    </Section>

                    <Section number="12" title="Indemnity">
                        <p>To the fullest extent permitted by law, you will indemnify and hold harmless Ro-Link Management Services and its personnel from claims, losses, liabilities, damages, costs, and expenses (including reasonable legal fees) arising out of your content, connected server or experience, use of the Services, or breach of these Terms, platform rules, or applicable law.</p>
                    </Section>

                    <Section number="13" title="Governing Law and Disputes">
                        <p>These Terms are governed by the laws of New Zealand. The courts of New Zealand have exclusive jurisdiction over any dispute arising out of or relating to these Terms or the Services, except where applicable law gives you a right to bring a matter in another forum that cannot be excluded by agreement.</p>
                        <p>Before starting court proceedings, you and Ro-Link agree to try in good faith to resolve the dispute through the Support Server. This does not prevent either party from seeking urgent injunctive or protective relief where appropriate.</p>
                    </Section>

                    <Section number="14" title="Changes, Notices, and General Terms">
                        <p>We may update these Terms by posting a revised version on this page and updating the &ldquo;Last updated&rdquo; date. Continuing to use the Services after an update takes effect means you accept the updated Terms.</p>
                        <p>Formal notices, legal notices, privacy requests, and support requests to Ro-Link must be submitted through the <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 font-bold">Ro-Link Support Server</a>. Notices from Ro-Link may be provided through the Services, dashboard, Discord, or another reasonable method.</p>
                        <p>If any provision of these Terms is unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them as part of a reorganisation, merger, or transfer of the Services. These Terms are the entire agreement between you and Ro-Link regarding the Services.</p>
                    </Section>
        </PublicPolicyPage>
    );
}
