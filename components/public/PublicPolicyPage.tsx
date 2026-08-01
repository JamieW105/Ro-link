import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';

export function PublicPolicyPage({ eyebrow, title, meta, intro, children }: {
    eyebrow: string;
    title: string;
    meta: string;
    intro: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="policy-title">
                    <PublicHeroBackdrop />
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">{eyebrow}</p>
                            <h1 className="rl-utility-title" id="policy-title">{title}</h1>
                        </div>
                        <div className="rl-policy-intro">
                            <p>{intro}</p>
                            <span>{meta}</span>
                        </div>
                    </div>
                </section>
                <div className="rl-policy-layout rl-shell">
                    <article className="rl-policy-content">{children}</article>
                </div>
            </main>
            <PublicFooter />
        </>
    );
}

export function PublicPolicySection({ number, title, children }: {
    number: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rl-policy-section">
            <div className="rl-policy-heading">
                <span>{number.padStart(2, '0')}</span>
                <h2>{title}</h2>
            </div>
            <div className="rl-policy-copy">{children}</div>
        </section>
    );
}

export function PublicPolicySubSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rl-policy-subsection">
            <h3>{title}</h3>
            <div>{children}</div>
        </div>
    );
}
