import { createClient } from '@supabase/supabase-js';

import { supabase } from './supabase';

const supabaseParams = {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
};

let adminClient: any = null;

export function getSupabaseAdmin() {
    if (adminClient) {
        return adminClient;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    adminClient = (url && serviceKey)
        ? createClient(url, serviceKey, supabaseParams)
        : supabase;

    return adminClient;
}
