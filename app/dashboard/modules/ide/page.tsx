import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import ModuleIdeClient from './ModuleIdeClient';

export default async function ModuleIdePage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/auth/signin?callbackUrl=/dashboard/modules/ide');
    return <ModuleIdeClient />;
}
