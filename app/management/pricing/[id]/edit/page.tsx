'use client';

import { use } from 'react';

import PricingPlanEditor from '@/app/management/pricing/PricingPlanEditor';

export default function EditPricingPlanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <PricingPlanEditor planId={id} />;
}
