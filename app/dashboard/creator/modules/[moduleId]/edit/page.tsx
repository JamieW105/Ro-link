import CreatorModules from '@/components/creator/CreatorModules';

export default async function EditCreatorModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
    const { moduleId } = await params;
    return <CreatorModules key={moduleId} moduleId={moduleId} />;
}
