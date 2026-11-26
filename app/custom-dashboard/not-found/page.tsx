import { Card } from '@/components/ui/card';

type PageProps = {
    searchParams: Promise<{ subdomain?: string }>;
};

export default async function CustomDashboardNotFoundPage({ searchParams }: PageProps) {
    const { subdomain } = await searchParams;

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
            <Card className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
                <img src="/Media/Ro-LinkIcon.png" alt="" className="mx-auto mb-5 h-12 w-12 rounded-xl" />
                <h1 className="text-2xl font-medium tracking-tight">Dashboard not found</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {subdomain
                        ? `No custom dashboard is configured for ${subdomain}.`
                        : 'No custom dashboard is configured for this address.'}
                </p>
            </Card>
        </div>
    );
}

