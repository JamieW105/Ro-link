'use client';

import { PublicPolicyPage, PublicPolicySection, PublicPolicySubSection } from '@/components/public/PublicPolicyPage';

function PolicySection({
    number,
    title,
    children,
}: {
    number: string;
    title: string;
    children: React.ReactNode;
}) {
    return <PublicPolicySection number={number} title={title}>{children}</PublicPolicySection>;
}

function SubSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return <PublicPolicySubSection title={title}>{children}</PublicPolicySubSection>;
}

export default function DgsuPolicyPage() {
    return (
        <PublicPolicyPage
            eyebrow="Binding policy"
            title="DGSU Policy"
            meta="Dangerous Game, Server, or User · Effective date: July 4, 2026"
            intro="How Ro-Link identifies and responds to games, servers, users, and connected communities that may present a safety or abuse risk."
        >
                    <PolicySection number="1" title="Binding Effect">
                        <p>
                            This DGSU Policy is incorporated into the Ro-Link Terms of Service. By using Ro-Link, inviting the bot, connecting a Roblox game, signing in to the dashboard, submitting a report, or interacting with Ro-Link services, you agree that Ro-Link staff may apply this policy when reviewing risk, abuse, and safety concerns.
                        </p>
                        <p>
                            A DGSU classification does not require a criminal finding, platform enforcement action, or complete certainty. Ro-Link may act when available evidence, behavior patterns, platform context, or operational risk show that a game, server, or user is likely unsafe for Ro-Link, its users, or connected communities.
                        </p>
                    </PolicySection>

                    <PolicySection number="2" title="General DGSU Standard">
                        <p>
                            A game, server, or user may be treated as a DGSU when it is used for, enables, encourages, coordinates, hides, or benefits from dangerous, abusive, deceptive, exploitative, or platform-violating activity. This includes direct conduct and indirect support such as hosting, recruiting, advertising, laundering traffic, evading enforcement, or knowingly giving unsafe users access to community tools.
                        </p>
                        <p>
                            The examples in this policy are not exhaustive. Ro-Link may act on similar conduct even when it is not named here, especially when the conduct creates a safety risk, moderation burden, data risk, legal risk, or platform compliance risk.
                        </p>
                    </PolicySection>

                    <PolicySection number="3" title="Dangerous Games">
                        <SubSection title="Exploit, Abuse, or Evasion Games">
                            <p>
                                A Roblox game may be a DGSU if it exists mainly to test, distribute, advertise, normalize, or coordinate exploits, bypasses, crash tools, malicious scripts, raid tools, moderation evasion, ban evasion, or unauthorized automation.
                            </p>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Games that instruct users how to bypass Roblox or Discord moderation systems.</li>
                                <li>Games that provide tools, scripts, links, or social instructions for exploiting other communities.</li>
                                <li>Games used as staging areas for raids, harassment, or coordinated abuse.</li>
                            </ul>
                        </SubSection>

                        <SubSection title="Scam, Phishing, or Impersonation Games">
                            <p>
                                A game may be a DGSU if it misleads users into giving up credentials, tokens, Robux, items, personal information, verification codes, or account access, or if it impersonates Ro-Link, Roblox, Discord, staff, verification systems, or trusted communities.
                            </p>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Fake verification games or fake reward games.</li>
                                <li>Games that pressure users to join suspicious Discord servers or open unsafe links.</li>
                                <li>Games that copy Ro-Link branding to misrepresent approval or partnership.</li>
                            </ul>
                        </SubSection>

                        <SubSection title="Unsafe or Prohibited Content Games">
                            <p>
                                A game may be a DGSU if it contains, promotes, coordinates, or is primarily associated with sexually explicit content, predatory conduct, serious harassment, threats, hate activity, extremist promotion, malware, account theft, gambling-like abuse, or other material that is unsafe for Ro-Link to support.
                            </p>
                            <p>
                                Ro-Link may also treat a game as a DGSU when the game itself appears clean but the connected server, owner, staff team, advertising, or user funnel is used for unsafe conduct.
                            </p>
                        </SubSection>
                    </PolicySection>

                    <PolicySection number="4" title="Dangerous Discord Servers">
                        <SubSection title="Coordination and Community Risk">
                            <p>
                                A Discord server may be a DGSU if it coordinates abuse, raids, harassment, exploit sharing, scam activity, phishing, impersonation, token theft, malicious downloads, account trading, unsafe verification flows, or other conduct that threatens Ro-Link users or connected Roblox communities.
                            </p>
                        </SubSection>

                        <SubSection title="Unsafe Ro-Link Use">
                            <p>
                                A server may be a DGSU if it uses Ro-Link to assist unsafe conduct, hide unsafe conduct, target users unfairly, gather information for harassment, evade prior moderation, or operate a community that Ro-Link staff reasonably determine is unsafe to support.
                            </p>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Using Ro-Link moderation tools to retaliate against reporters or critics.</li>
                                <li>Connecting Ro-Link to games or servers that are already blocked or under active safety review.</li>
                                <li>Repeatedly removing evidence, renaming servers, or moving users to avoid review.</li>
                            </ul>
                        </SubSection>

                        <SubSection title="Server Ownership and Staff Responsibility">
                            <p>
                                Server owners and administrators are responsible for the servers they connect to Ro-Link. A server may be classified as a DGSU based on owner conduct, staff conduct, server configuration, affiliated games, affiliated users, or repeated failure to address obvious dangerous activity.
                            </p>
                        </SubSection>
                    </PolicySection>

                    <PolicySection number="5" title="Dangerous Users">
                        <SubSection title="Roblox Users">
                            <p>
                                A Roblox user may be a DGSU if they exploit games, distribute malicious scripts, coordinate abuse, operate scam games, impersonate staff, evade bans, threaten other users, target communities, or use connected Roblox identities to hide dangerous conduct.
                            </p>
                        </SubSection>

                        <SubSection title="Discord Users">
                            <p>
                                A Discord user may be a DGSU if they use Discord to coordinate unsafe activity, run scam or phishing operations, impersonate Ro-Link or community staff, threaten users, harass reporters, evade server blocks, submit knowingly false reports, or abuse Ro-Link access.
                            </p>
                        </SubSection>

                        <SubSection title="Linked and Alternate Accounts">
                            <p>
                                Ro-Link may consider linked accounts, alternate accounts, usernames, user IDs, ownership records, verified Roblox identities, Discord IDs, report history, moderation logs, and known associations when deciding whether a user is dangerous. A user cannot avoid review only by switching accounts, changing names, or moving activity to another server.
                            </p>
                        </SubSection>
                    </PolicySection>

                    <PolicySection number="6" title="Evidence and Review">
                        <p>
                            Ro-Link may consider Discord image links, screenshots, message links, user IDs, server IDs, game IDs, Roblox profile data, Discord profile data, Ro-Link logs, dashboard activity, public posts, support tickets, staff observations, platform signals, and reports from trusted community members.
                        </p>
                        <p>
                            Evidence may be incomplete, time-sensitive, or removed by the reported party. Ro-Link may still act when the remaining information is reliable enough to show risk. False, manipulated, misleading, or retaliatory reports may result in moderation action against the reporter.
                        </p>
                    </PolicySection>

                    <PolicySection number="7" title="Ro-Link Actions">
                        <p>
                            When Ro-Link classifies or suspects a DGSU, staff may take one or more actions without prior notice. Actions may include refusing service, removing the bot, blocking a server, restricting dashboard access, disabling integrations, preserving evidence, closing reports, escalating reports, notifying affected communities, or reporting content to Roblox, Discord, hosting providers, or appropriate authorities when necessary.
                        </p>
                        <p>
                            Ro-Link is not required to provide full evidence, internal review notes, detection methods, or reporter identities when taking action. Staff may limit details to protect users, prevent evasion, preserve privacy, or avoid exposing abuse detection methods.
                        </p>
                    </PolicySection>

                    <PolicySection number="8" title="Appeals and Changes">
                        <p>
                            A classified game, server, or user may request review through Ro-Link support. Appeals should include the relevant IDs, a clear explanation, and evidence showing that the risk has been resolved or that the classification was incorrect.
                        </p>
                        <p>
                            Ro-Link may update this policy at any time. Continued use of Ro-Link after an update means the updated policy applies to your use of the service.
                        </p>
                    </PolicySection>
        </PublicPolicyPage>
    );
}
