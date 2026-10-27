import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
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
                            <Card className={`rl-pricing-card${plan.featured && plan.available && !plan.comingSoon ? ' rl-pricing-card-featured' : ''}${!plan.available || plan.comingSoon ? ' rl-pricing-card-unavailable' : ''}`} key={plan.id}>
                                {plan.comingSoon ? <Status render={<span />} variant="default" className="rl-pricing-badge rl-pricing-badge-coming-soon">Coming soon</Status> : !plan.available ? <Status render={<span />} variant="default" className="rl-pricing-badge rl-pricing-badge-unavailable">Unavailable</Status> : plan.featured && <Status render={<span />} variant="default" className="rl-pricing-badge">Recommended</Status>}
                                <CardTitle>{plan.name}</CardTitle>
                                <div className="rl-pricing-price"><strong>{plan.price}</strong>{plan.cadence && <span>{plan.cadence}</span>}</div>
                                <CardDescription>{plan.description}</CardDescription>
                                <ul>
                                    {plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}
                                </ul>
                                {!plan.available || plan.comingSoon ? (
                                    <Button type="button" disabled>{plan.comingSoon ? 'Coming soon' : 'Unavailable'}</Button>
                                ) : external ? (
                                    <Button asChild variant="default"><a href={plan.ctaUrl} target="_blank" rel="noopener noreferrer">{button}</a></Button>
                                ) : (
                                    <Button asChild variant="default"><Link href={plan.ctaUrl}>{button}</Link></Button>
                                )}
                            </Card>
                        );
                    })}
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
