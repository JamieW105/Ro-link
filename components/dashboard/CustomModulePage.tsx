"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type CustomModule = { id: string; name: string; description: string; version: string; isCustom?: boolean };

export default function CustomModulePage() {
    const { id, moduleId } = useParams<{ id: string; moduleId?: string }>();
    const serverId = id;
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(Boolean(moduleId));
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customVersion, setCustomVersion] = useState('');
    const [customSourceCode, setCustomSourceCode] = useState('');
    const [customUploadTarget, setCustomUploadTarget] = useState<CustomModule | null>(null);
    const [uploadingCustom, setUploadingCustom] = useState(false);

    useEffect(() => {
        if (!moduleId) return;
        let active = true;
        async function loadTarget() {
            try {
                const response = await fetch(`/api/dashboard/modules?serverId=${encodeURIComponent(serverId)}`, { cache: 'no-store' });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || 'Failed to load module.');
                const target = payload.modules?.find((module: CustomModule) => module.id === moduleId && module.isCustom);
                if (!target) throw new Error('Custom module not found.');
                if (!active) return;
                setCustomUploadTarget(target);
                setCustomName(target.name);
                setCustomDescription(target.description);
                setCustomVersion(target.version);
            } catch (error) {
                if (active) setError(error instanceof Error ? error.message : 'Failed to load module.');
            } finally {
                if (active) setLoading(false);
            }
        }
        void loadTarget();
        return () => { active = false; };
    }, [moduleId, serverId]);

    async function submitCustomModule() {
        setUploadingCustom(true);
        setError(null);

        try {
            const response = await fetch('/api/dashboard/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    moduleId: customUploadTarget?.id,
                    action: customUploadTarget ? 'custom-reupload' : 'custom-create',
                    name: customName,
                    description: customDescription,
                    version: customVersion,
                    sourceCode: customSourceCode,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(String(payload.error || 'Custom module upload failed.'));
            }

            if (payload.warning) {
                setWarning(`Custom module saved but cannot run yet. ${payload.warning}`);
                setSaved(true);
                return;
            }

            router.push(`/dashboard/${serverId}/modules`);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Custom module upload failed.');
        } finally {
            setUploadingCustom(false);
        }
    }

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost"><Link href={`/dashboard/${serverId}/modules`}><ArrowLeft className="size-4" aria-hidden="true" />Back to modules</Link></Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {warning && <Card role="status" className="p-4 text-sm text-foreground">{warning}</Card>}
            {loading ? <p role="status" className="text-muted-foreground">Loading module…</p> : (!moduleId || customUploadTarget) && (
            <Card className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">{customUploadTarget ? "Re-upload custom module" : "Create custom module"}</h1>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            Upload Luau directly to this server without submitting it to the module marketplace.
                        </p>
                    </div>

                </div>

                <form onSubmit={(event) => { event.preventDefault(); void submitCustomModule(); }} className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                        <Input
                            value={customName}
                            onChange={(event) => setCustomName(event.target.value)}
                            aria-label="Module name"
                            placeholder="Module name"
                            className="w-full transition-colors"
                        />
                        <Input
                            value={customVersion}
                            onChange={(event) => setCustomVersion(event.target.value)}
                            aria-label="Version"
                            placeholder="Version"
                            className="w-full transition-colors"
                        />
                        <Textarea
                            value={customDescription}
                            onChange={(event) => setCustomDescription(event.target.value)}
                            aria-label="Description"
                            placeholder="Description"
                            rows={4}
                            className="w-full resize-none transition-colors"
                        />
                    </div>
                    <div className="space-y-3">
                        {customUploadTarget && (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                Re-uploading {customUploadTarget.name}. Paste the replacement source below.
                            </div>
                        )}
                        <Textarea
                            value={customSourceCode}
                            onChange={(event) => setCustomSourceCode(event.target.value)}
                            aria-label="Luau module source"
                            placeholder="Paste Luau module source"
                            rows={10}
                            className="custom-scrollbar w-full resize-y transition-colors"
                        />
                        <Button variant="default" size="default"
                            type="submit"
                            disabled={saved || uploadingCustom || !customName.trim() || !customSourceCode.trim()}
                            className="transition-colors disabled:opacity-50"
                        >
                            {uploadingCustom ? 'Uploading' : customUploadTarget ? 'Re-upload Module' : 'Upload Module'}
                        </Button>
                    </div>
                </form>
            </Card>

            )}
        </div>
    );
}
