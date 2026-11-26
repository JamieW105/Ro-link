'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

type Notice = boolean | string | { type: 'success' | 'error'; text: string } | null;

/** Success feedback expires after three seconds; errors remain available to read. */
export function useSuccessNotice<T extends Notice>(emptyValue: T): [T, Dispatch<SetStateAction<T>>] {
    // A wrapper gives repeated identical confirmations their own timer.
    const [entry, setEntry] = useState({ value: emptyValue });
    const setNotice = useCallback<Dispatch<SetStateAction<T>>>((next) => {
        setEntry(previous => ({
            value: typeof next === 'function' ? next(previous.value) : next,
        }));
    }, []);

    useEffect(() => {
        const value = entry.value;
        const isSuccess = typeof value === 'object'
            ? value?.type === 'success'
            : Boolean(value);
        if (!isSuccess) return;

        const timeout = window.setTimeout(() => setEntry({ value: emptyValue }), 3000);
        return () => window.clearTimeout(timeout);
    }, [entry, emptyValue]);

    return [entry.value, setNotice];
}
