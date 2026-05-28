export type RateLimitRule = {
    limit: number;
    windowMs: number;
    blockMs?: number;
};

export type RateLimitResult = {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfterSeconds: number;
};

type Bucket = {
    count: number;
    resetAt: number;
    blockedUntil: number;
};

const buckets = new Map<string, Bucket>();
let cleanupCounter = 0;

function cleanupExpiredBuckets(now: number) {
    cleanupCounter += 1;
    if (cleanupCounter % 100 !== 0 && buckets.size < 5000) {
        return;
    }

    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now && bucket.blockedUntil <= now) {
            buckets.delete(key);
        }
    }
}

export function getRateLimitBlock(key: string): RateLimitResult | null {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.blockedUntil <= now) {
        return null;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000));
    return {
        allowed: false,
        limit: bucket.count,
        remaining: 0,
        resetAt: bucket.blockedUntil,
        retryAfterSeconds,
    };
}

export function consumeRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        bucket = {
            count: 0,
            resetAt: now + rule.windowMs,
            blockedUntil: 0,
        };
        buckets.set(key, bucket);
    }

    if (bucket.blockedUntil > now) {
        return {
            allowed: false,
            limit: rule.limit,
            remaining: 0,
            resetAt: bucket.blockedUntil,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
        };
    }

    bucket.count += 1;

    if (bucket.count > rule.limit) {
        bucket.blockedUntil = now + (rule.blockMs ?? rule.windowMs);
        return {
            allowed: false,
            limit: rule.limit,
            remaining: 0,
            resetAt: bucket.blockedUntil,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
        };
    }

    return {
        allowed: true,
        limit: rule.limit,
        remaining: Math.max(0, rule.limit - bucket.count),
        resetAt: bucket.resetAt,
        retryAfterSeconds: 0,
    };
}

export function rateLimitHeaders(result: RateLimitResult) {
    return {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
    };
}
