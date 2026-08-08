import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import { getDiscordBotInviteUrl } from '@/lib/discordInvite';
import { getSiteContent } from '@/lib/siteContent';

export const revalidate = 60;

export default async function FeaturesPage() {
    const content = await getSiteContent('features');
    const features = content.sections.filter((feature) => feature.enabled);
    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-features-hero" aria-labelledby="features-title">
                    <PublicHeroBackdrop />
                    <div className="rl-features-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">{content.eyebrow}</p>
                            <h1 className="rl-features-title" id="features-title">{content.title} <span>{content.highlightedTitle}</span></h1>
                        </div>
                        <p className="rl-features-intro">
                            {content.intro}
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
                        {features.map((feature, index) => (
                            <section className="rl-feature-detail" id={feature.id} key={feature.id} aria-labelledby={`${feature.id}-title`}>
                                <span className="rl-feature-number">{String(index + 1).padStart(2, '0')}</span>
                                <div className="rl-feature-heading">
                                    <h2 id={`${feature.id}-title`}>{feature.title}</h2>
                                    {feature.comingSoon && <span className="rl-coming-soon-badge">Coming soon</span>}
                                </div>
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
