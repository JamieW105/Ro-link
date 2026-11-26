interface LogFilterQuery<T> {
    is(column: string, value: null): T;
    not(column: string, operator: string, value: string): T;
}

// Staff actions have their own audit records in staff_moderation_actions.
// Hide legacy copies, including older rows without a moderation_action_id,
// before pagination so they cannot displace actual server activity.
export function excludeManagementLogs<T extends LogFilterQuery<T>>(query: T): T {
    return query
        .is('moderation_action_id', null)
        .not('action', 'in', '(RO_LINK_REMOVED,RO_LINK_BLOCKED)');
}
