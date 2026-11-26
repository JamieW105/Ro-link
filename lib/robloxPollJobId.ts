export function readRobloxPollJobId(
    body: Record<string, unknown>,
    headers: Headers,
): string | null {
    const candidates = [body.jobId, body.job_id, body.JobId, headers.get('x-roblox-job-id')];
    for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue;

        const jobId = candidate.trim();
        if (jobId) return jobId;
    }

    return null;
}
