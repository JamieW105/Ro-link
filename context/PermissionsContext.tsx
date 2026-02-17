
'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface Permissions {
    can_access_dashboard: boolean;
    can_kick: boolean;
    can_ban: boolean;
    can_timeout: boolean;
    can_mute: boolean;
    can_lookup: boolean;
    can_manage_settings: boolean;
    can_manage_reports: boolean;
    allowed_misc_cmds: string[];
    is_admin: boolean;
}

const PermissionsContext = createContext<Permissions | null>(null);

export function PermissionsProvider({ permissions, children }: { permissions: Permissions; children: ReactNode }) {
    return (
        <PermissionsContext.Provider value={permissions}>
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissions() {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
}
