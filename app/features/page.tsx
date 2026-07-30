import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import { getDiscordBotInviteUrl } from '@/lib/discordInvite';

const features = [
    {
        id: 'servers',
        number: '01',
        title: 'Live server visibility',
        description: 'Give staff a shared view of active Roblox servers without asking players for server details or switching between separate admin tools.',
        items: ['View active server sessions', 'Check player presence and counts', 'Review live server information from the dashboard'],
    },
    {
        id: 'moderation',
        number: '02',
        title: 'Discord moderation controls',
        description: 'Keep supported game-management actions close to the conversation where staff receive reports and coordinate responses.',
        items: ['Run supported moderation actions from Discord', 'Use slash commands with clear staff permissions', 'Act without sharing Roblox owner credentials'],
    },
    {
        id: 'identity',
        number: '03',
        title: 'Linked player identity',
        description: 'Connect Discord members with their Roblox accounts so staff know which player they are helping, reviewing, or moderating.',
        items: ['Link Discord and Roblox accounts', 'Verify a member before protected submissions', 'Use linked identity during staff review'],
    },
    {
        id: 'permissions',
        number: '04',
        title: 'Role-based staff access',
        description: 'Assign access according to staff responsibilities instead of giving every moderator the same level of control.',
        items: ['Map dashboard roles to Discord staff', 'Control access to logs and staff notes', 'Restrict management tools to trusted roles'],
    },
    {
        id: 'reports',
        number: '05',
        title: 'Reports and staff context',
        description: 'Keep community reports, linked player details, and internal staff context together so reviews are easier to follow.',
        items: ['Accept reports through the public report flow', 'Review submissions with linked account context', 'Keep staff-only notes behind permissions'],
    },
    {
        id: 'setup-tools',
        number: '06',
        title: 'Guided Roblox setup',
        description: 'Connect the Discord bot, web dashboard, and Roblox experience through a guided setup rather than wiring each part together manually.',
        items: ['Connect through the Roblox Studio plugin', 'Register the experience with Ro-Link', 'Use the documentation for setup and troubleshooting'],
    },
];

export default function FeaturesPage() {
    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-features-hero" aria-labelledby="features-title">
                    <PublicHeroBackdrop />
                    <div className="rl-features-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">Ro-Link features</p>
                            <h1 className="rl-features-title" id="features-title">The tools behind <span>live game management.</span></h1>
                        </div>
                        <p className="rl-features-intro">
                            Ro-Link connects Discord staff workflows to Roblox operations. See what each part does and where it fits into day-to-day community management.
                        </p>
                    </div>
                </section>

                <div className="rl-features-layout rl-shell">
                    <aside className="rl-feature-index">
                        <h2>On this page</h2>
                        <nav aria-label="Feature sections">
                            {features.map((feature) => <a href={`#${feature.id}`} key={feature.id}>{feature.title}</a>)}
                        </nav>
                    </aside>

                    <div className="rl-feature-list">
                        {features.map((feature) => (
                            <section className="rl-feature-detail" id={feature.id} key={feature.id} aria-labelledby={`${feature.id}-title`}>
                                <span className="rl-feature-number">{feature.number}</span>
                                <h2 id={`${feature.id}-title`}>{feature.title}</h2>
                                <div className="rl-feature-detail-copy">
                                    <p>{feature.description}</p>
                                    <ul>
                                        {feature.items.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </div>
                            </section>
                        ))}
                    </div>
                </div>

                <section className="rl-compact-cta rl-shell" aria-labelledby="features-cta-title">
                    <div>
                        <h2 id="features-cta-title">Ready to set up Ro-Link?</h2>
                        <p>Install the bot, then follow the guided connection flow.</p>
                    </div>
                    <a className="rl-button rl-button-primary" href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer">Install Ro-Link</a>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
