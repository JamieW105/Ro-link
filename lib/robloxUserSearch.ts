export type RobloxUserSearchResult = {
    users: unknown[];
    unavailable: boolean;
};

const cache = new Map<string, { expiresAt: number; result: RobloxUserSearchResult }>();
const pending = new Map<string, Promise<RobloxUserSearchResult>>();
let retryAfter = 0;
const unavailable: RobloxUserSearchResult = { users: [], unavailable: true };

// Public Roblox search is rate limited. Share concurrent searches and briefly cache
// results so typing/backspacing and multiple dashboard users do not repeat requests.
export async function searchRobloxUsers(rawQuery: string): Promise<RobloxUserSearchResult> {
    const query = rawQuery.trim().toLowerCase().replace(/^@/, '').slice(0, 80);
    if (query.length < 2) return { users: [], unavailable: false };
    const cached = cache.get(query);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    if (retryAfter > Date.now()) return unavailable;
    const existing = pending.get(query);
    if (existing) return existing;

    const request = (async (): Promise<RobloxUserSearchResult> => {
        try {
            const response = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=10`, {
                headers: { Accept: 'application/json' },
                cache: 'no-store',
                signal: AbortSignal.timeout(4000),
            });
            if (!response.ok) {
                if (response.status === 429) {
                    const header = response.headers.get('retry-after');
                    const seconds = header ? Number(header) : NaN;
                    const delay = Number.isFinite(seconds) ? seconds * 1000
                        : header ? Date.parse(header) - Date.now() : 30_000;
                    retryAfter = Date.now() + (Number.isFinite(delay) ? Math.max(1000, Math.min(delay, 60_000)) : 30_000);
                }
                return unavailable;
            }
            const payload = await response.json();
            return Array.isArray(payload?.data) ? { users: payload.data, unavailable: false } : unavailable;
        } catch {
            return unavailable;
        }
    })();
    pending.set(query, request);
    try {
        const result = await request;
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(query, { result, expiresAt: Date.now() + (result.unavailable ? 5000 : 30_000) });
        return result;
    } finally {
        pending.delete(query);
    }
}
