import Link from 'next/link';

const STATUS_PAGE_URL = 'https://status.rolink.cloud';

export function PublicFooter() {
    return (
        <footer className="rl-public-footer">
            <div className="rl-footer-inner rl-shell">
                <span>© {new Date().getFullYear()} Core Engine Solutions Management Group</span>
                <div className="rl-footer-links">
                    <Link href="/privacy">Privacy</Link>
                    <Link href="/terms">Terms</Link>
                    <a href={STATUS_PAGE_URL} target="_blank" rel="noopener noreferrer">Status</a>
                </div>
            </div>
        </footer>
    );
}
