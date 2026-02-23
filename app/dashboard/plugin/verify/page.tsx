'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

function VerifyPluginContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) {
            setStatus('Invalid session parameter.');
        }
    }, [sessionId]);

    const handleVerify = async () => {
        if (!sessionId) return;
        setLoading(true);

        try {
            const response = await fetch('/api/v1/plugin/auth/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId }),
            });

            if (response.ok) {
                setStatus('Successfully verified! You may now return to Roblox Studio.');
            } else {
                const data = await response.json();
                setStatus(data.error || 'Failed to verify session.');
            }
        } catch (error) {
            setStatus('Network error occurred.');
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                <h1 className="text-2xl font-bold mb-4">RoLink Studio Verification</h1>
                <p className="mb-6 text-gray-400">
                    A Roblox Studio session is requesting access to your RoLink account and permission to manage your games.
                </p>

                {status ? (
                    <div className="p-4 bg-blue-900/50 rounded-md text-blue-200 font-medium">
                        {status}
                    </div>
                ) : (
                    <button
                        onClick={handleVerify}
                        disabled={loading || !sessionId}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Verifying...' : 'Approve Access'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function VerifyPlugin() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>}>
            <VerifyPluginContent />
        </Suspense>
    );
}
