'use client';

import { ArrowRight, BriefcaseBusiness, Lock, Search, Tag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';

interface Job {
    id: string;
    title: string;
    description: string;
    requirements: string;
    tags: string[];
    status: 'OPEN' | 'CLOSED';
    created_at: string;
}

const tags = ['Developer', 'Support', 'Moderation', 'Marketing'];

export default function CareersPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTag, setActiveTag] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/careers')
            .then((response) => response.json())
            .then((data) => setJobs(Array.isArray(data) ? data : []))
            .catch(() => setJobs([]))
            .finally(() => setLoading(false));
    }, []);

    const query = search.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
        const matchesSearch = !query
            || job.title?.toLowerCase().includes(query)
            || job.description?.toLowerCase().includes(query);
        const matchesTag = !activeTag || job.tags?.includes(activeTag);
        return matchesSearch && matchesTag;
    });

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="careers-title">
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">Careers</p>
                            <h1 className="rl-utility-title" id="careers-title">Help build the connection <span>between Discord and Roblox.</span></h1>
                        </div>
                        <p className="rl-utility-intro">
                            Browse current Ro-Link opportunities across development, support, moderation, and marketing. Applications require a signed-in Discord account and linked Roblox account.
                        </p>
                    </div>
                </section>

                <section className="rl-utility-main rl-shell">
                    <div className="rl-toolbar">
                        <div className="rl-search-wrap">
                            <Search aria-hidden="true" />
                            <label className="rl-sr-only" htmlFor="career-search">Search positions</label>
                            <input
                                className="rl-search-field"
                                id="career-search"
                                type="search"
                                placeholder="Search positions…"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <div className="rl-filter-chips" aria-label="Filter positions">
                            <button className="rl-filter-chip" type="button" aria-pressed={!activeTag} onClick={() => setActiveTag(null)}>All</button>
                            {tags.map((tagName) => (
                                <button
                                    className="rl-filter-chip"
                                    key={tagName}
                                    type="button"
                                    aria-pressed={activeTag === tagName}
                                    onClick={() => setActiveTag(tagName)}
                                >
                                    {tagName}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="rl-loading-line" aria-label="Loading current positions" />
                    ) : filtered.length === 0 ? (
                        <div className="rl-empty-state">
                            <BriefcaseBusiness aria-hidden="true" />
                            <strong>No matching positions</strong>
                            <span>Try another search or check back for current openings.</span>
                        </div>
                    ) : (
                        <div className="rl-data-list">
                            {filtered.map((job) => {
                                const rowContent = (
                                    <>
                                        <div>
                                            <div className="rl-data-row-meta">
                                                <span>
                                                    {job.status === 'OPEN'
                                                        ? <BriefcaseBusiness aria-hidden="true" />
                                                        : <Lock aria-hidden="true" />}
                                                    {job.status === 'OPEN' ? 'Open position' : 'Closed'}
                                                </span>
                                                {(job.tags || []).map((tagName) => <span key={tagName}><Tag aria-hidden="true" />{tagName}</span>)}
                                            </div>
                                            <h2>{job.title}</h2>
                                            <p>{job.description}</p>
                                        </div>
                                        <span className="rl-data-row-action">
                                            {job.status === 'OPEN'
                                                ? <ArrowRight aria-hidden="true" />
                                                : <Lock aria-hidden="true" />}
                                        </span>
                                    </>
                                );

                                return job.status === 'OPEN' ? (
                                    <Link className="rl-data-row" href={`/careers/${job.id}`} key={job.id}>
                                        {rowContent}
                                    </Link>
                                ) : (
                                    <div className="rl-data-row rl-data-row--closed" key={job.id}>
                                        {rowContent}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
