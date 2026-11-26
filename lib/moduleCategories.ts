const MODULE_CATEGORIES = ['General', 'Moderation', 'Administration', 'Community', 'Utilities', 'Integrations'];

/** Keep stored categories selectable when editing older modules. */
export function moduleCategoryOptions(existing: string[] = []) {
    return [...new Set([...MODULE_CATEGORIES, ...existing.filter(Boolean)])]
        .map(value => ({ value, label: value }));
}
