export function coalesceRead<T>(read: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | undefined;

    return () => {
        pending ??= read().finally(() => {
            pending = undefined;
        });
        return pending;
    };
}
