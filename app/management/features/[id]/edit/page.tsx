'use client';

import { use } from 'react';

import FeatureEditor from '@/app/management/features/FeatureEditor';

export default function EditFeaturePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <FeatureEditor featureId={id} />;
}
