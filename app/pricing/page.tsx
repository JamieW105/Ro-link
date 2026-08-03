import { Check } from 'lucide-react';
import Link from 'next/link';

import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import { getSiteContent } from '@/lib/siteContent';

export const revalidate = 60;

export default async function PricingPage() {
    const content = await getSiteContent('pricing');
    const plans = content.plans.filter((plan) => plan.enabled);

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-pricing-hero" aria-labelledby="pricing-title">
                    <PublicHeroBackdrop />
                    <div className="rl-pricing-hero-inner rl-shell">
                        <p className="rl-eyebrow">{content.eyebrow}</p>
                        <h1 className="rl-pricing-title" id="pricing-title">{content.title} <span>{content.highlightedTitle}</span></h1>
                        <p className="rl-pricing-intro">{content.intro}</p>
                    </div>
                </section>

                <section className="rl-pricing-grid rl-shell" aria-label="Pricing plans">
                    {plans.map((plan) => {
                        const external = /^https?:\/\//.test(plan.ctaUrl);
                        const button = <>{plan.ctaLabel}</>;
                        return (
                            <article className={`rl-pricing-card${plan.featured ? ' rl-pricing-card-featured' : ''}`} key={plan.id}>
                                {plan.featured && <span className="rl-pricing-badge">Recommended</span>}
                                <h2>{plan.name}</h2>
                                <div className="rl-pricing-price"><strong>{plan.price}</strong>{plan.cadence && <span>{plan.cadence}</span>}</div>
                                <p>{plan.description}</p>
                                <ul>
                                    {plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}
                                </ul>
                                {external ? (
                                    <a className="rl-button rl-button-primary" href={plan.ctaUrl} target="_blank" rel="noopener noreferrer">{button}</a>
                                ) : (
                                    <Link className="rl-button rl-button-primary" href={plan.ctaUrl}>{button}</Link>
                                )}
                            </article>
                        );
                    })}
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
