import { getSupabaseAdmin } from './supabaseAdmin';
import { validateModuleCoverSelection } from './moduleCoverServer';
export async function moduleCoverSelectionError(paths: string[] | undefined, ownerId: string): Promise<Response | null> {
    if (paths === undefined || paths.length === 0) return null;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Cover image storage is not configured.' }, { status: 503 });
    try {
        if (await validateModuleCoverSelection(getSupabaseAdmin(), paths, ownerId)) return null;
        return Response.json({ error: 'Select up to four cover images uploaded by your account.' }, { status: 400 });
    } catch {
        return Response.json({ error: 'Could not verify cover images. Please try again.' }, { status: 503 });
    }
}
