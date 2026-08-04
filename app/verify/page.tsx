'use client';

import { Box, Check, Link2, LockKeyhole, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeroBackdrop } from '@/components/public/PublicHeroBackdrop';
import { DiscordIcon } from '@/components/ui/DiscordIcon';
import { DGSU_BAN_AUTH_ERROR, DGSU_BAN_ERROR_MESSAGE } from '@/lib/dgsuBanConstants';
import { buildRobloxAvatarUrl } from '@/lib/robloxAvatars';

type LinkedAccount = {
    roblox_id: string;
    roblox_username: string;
};

export default function VerifyPage() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);
    const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
    const [fetchingLinked, setFetchingLinked] = useState(true);
    const [failedAvatarUserId, setFailedAvatarUserId] = useState<string | null>(null);
    const pageError = session?.error === DGSU_BAN_AUTH_ERROR ? DGSU_BAN_ERROR_MESSAGE : null;

    useEffect(() => {
        let cancelled = false;

        async function loadLinkedAccount() {
            const response = await fetch('/api/verify/linked-account', { cache: 'no-store' });
            if (cancelled) return;

            if (response.ok) {
                const data: LinkedAccount | null = await response.json();
                if (!cancelled && data) setLinkedAccount(data);
            }

            if (!cancelled) setFetchingLinked(false);
        }

        if (session?.user) {
            loadLinkedAccount();
        } else if (status !== 'loading') {
            queueMicrotask(() => {
                if (!cancelled) setFetchingLinked(false);
            });
        }

        return () => {
            cancelled = true;
        };
    }, [session, status]);

    function handleRobloxLink() {
        setLoading(true);
        window.location.href = '/api/roblox/auth';
    }

    const authLoading = status === 'loading' || fetchingLinked;
    const linkedRobloxUserId = linkedAccount?.roblox_id ? String(linkedAccount.roblox_id) : '';
    const avatarFailed = failedAvatarUserId === linkedRobloxUserId;
    const linkedRobloxAvatarUrl = linkedRobloxUserId
        ? buildRobloxAvatarUrl(linkedRobloxUserId, 420)
        : null;

    return (
        <>
            <main className="rl-public-page" id="top">
                <section className="rl-utility-hero" aria-labelledby="verify-title">
                    <PublicHeroBackdrop />
                    <div className="rl-utility-hero-inner rl-shell">
                        <div>
                            <p className="rl-eyebrow">Account verification</p>
                            <h1 className="rl-utility-title" id="verify-title">
                                Link your accounts. <span>Stay verified.</span>
                            </h1>
                        </div>
                        <p className="rl-utility-intro">
                            Connect Discord and Roblox through their official sign-in flows, then let Ro-Link keep your community roles in sync.
                        </p>
                    </div>
                </section>

                <section className="rl-utility-main rl-shell">
                    <div className="rl-utility-grid">
                        <section className="rl-surface" aria-labelledby="connection-title">
                            <div className="rl-surface-header">
                                <div>
                                    <h2 id="connection-title">Account connection</h2>
                                    <p>Connect Discord and Roblox to verify your Ro-Link identity.</p>
                                </div>
                                <span className="rl-surface-icon"><Link2 aria-hidden="true" /></span>
                            </div>

                            <div className="rl-surface-body">
                                {pageError ? <div className="rl-feedback rl-feedback-error mb-4">{pageError}</div> : null}

                                {authLoading ? (
                                    <div className="rl-notice" role="status">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                                        <div><strong>Checking your connection</strong>Confirming your Discord and Roblox account status.</div>
                                    </div>
                                ) : !session ? (
                                    <div className="rl-notice">
                                        <DiscordIcon aria-hidden="true" width="16" height="16" />
                                        <div>
                                            <strong>Start with Discord</strong>
                                            Sign in with Discord before linking the Roblox account you want Ro-Link to verify.
                                            <button className="rl-button rl-button-primary mt-4" type="button" onClick={() => signIn('discord')}>
                                                <DiscordIcon aria-hidden="true" width="15" height="15" />
                                                Sign in with Discord
                                            </button>
                                        </div>
                                    </div>
                                ) : linkedAccount ? (
                                    <div className="rl-verify-linked">
                                        <div className="rl-verify-profile">
                                            <div className="rl-verify-avatar">
                                                <Image
                                                    src={!avatarFailed && linkedRobloxAvatarUrl ? linkedRobloxAvatarUrl : '/Media/Roblox.png'}
                                                    alt={linkedAccount.roblox_username}
                                                    width={80}
                                                    height={80}
                                                    unoptimized
                                                    onError={() => setFailedAvatarUserId(linkedRobloxUserId)}
                                                    className={avatarFailed ? 'rl-verify-avatar-fallback' : undefined}
                                                />
                                            </div>
                                            <div>
                                                <span className="rl-field-label">Linked Roblox account</span>
                                                <h3>{linkedAccount.roblox_username}</h3>
                                                <p>ID: {linkedAccount.roblox_id}</p>
                                                <span className="rl-verify-status"><Check aria-hidden="true" /> Verified</span>
                                            </div>
                                        </div>
                                        <div className="rl-form-footer">
                                            <p>Your Ro-Link server roles will update automatically.</p>
                                            <button className="rl-button" type="button" onClick={handleRobloxLink} disabled={loading}>
                                                <RefreshCw aria-hidden="true" width={14} height={14} />
                                                {loading ? 'Opening Roblox…' : 'Change account'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rl-verify-unlinked">
                                        <div className="rl-verify-progress-heading">
                                            <div>
                                                <span className="rl-field-label">Verification progress</span>
                                                <h3>One step left</h3>
                                                <p>Choose the Roblox account you want connected to your Discord identity.</p>
                                            </div>
                                            <span className="rl-verify-progress-count">1 of 2 connected</span>
                                        </div>

                                        <div className="rl-verify-account-list">
                                            <div className="rl-verify-account-row rl-verify-account-row-complete">
                                                <span className="rl-verify-platform-icon">
                                                    <DiscordIcon aria-hidden="true" width="18" height="18" />
                                                </span>
                                                <div className="rl-verify-account-copy">
                                                    <strong>Discord</strong>
                                                    <span>{session.user?.name || 'Signed in'}</span>
                                                </div>
                                                <span className="rl-verify-account-state rl-verify-account-state-complete">
                                                    <Check aria-hidden="true" /> Connected
                                                </span>
                                            </div>

                                            <div className="rl-verify-account-row">
                                                <span className="rl-verify-platform-icon">
                                                    <Box aria-hidden="true" />
                                                </span>
                                                <div className="rl-verify-account-copy">
                                                    <strong>Roblox</strong>
                                                    <span>No account connected</span>
                                                </div>
                                                <span className="rl-verify-account-state">Required</span>
                                            </div>
                                        </div>

                                        <div className="rl-verify-unlinked-footer">
                                            <p>You’ll continue to Roblox to securely authorize your account.</p>
                                            <button
                                                className="rl-button rl-button-primary"
                                                type="button"
                                                onClick={handleRobloxLink}
                                                disabled={loading}
                                                aria-busy={loading}
                                            >
                                                {loading ? (
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" aria-hidden="true" />
                                                ) : (
                                                    <Box aria-hidden="true" width={15} height={15} />
                                                )}
                                                {loading ? 'Redirecting…' : 'Continue with Roblox'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="rl-aside-stack">
                            <div className="rl-surface rl-aside-panel">
                                <h2>How verification works</h2>
                                <ul className="rl-aside-list">
                                    <li><Check aria-hidden="true" /><span>Sign in with your Discord account.</span></li>
                                    <li><Check aria-hidden="true" /><span>Authorize your Roblox account.</span></li>
                                    <li><Check aria-hidden="true" /><span>Ro-Link keeps eligible roles synchronized.</span></li>
                                </ul>
                            </div>
                            <div className="rl-notice">
                                <LockKeyhole aria-hidden="true" />
                                <div><strong>Official OAuth</strong>Your password is entered only on Discord or Roblox, never on Ro-Link.</div>
                            </div>
                        </aside>
                    </div>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
