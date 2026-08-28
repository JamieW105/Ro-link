export const MODULE_CATEGORIES = ['General', 'Moderation', 'Misc', 'Fun', 'Troll'] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export function parseModuleCategory(value: unknown): ModuleCategory | null {
    const category = String(value ?? '').trim();
    return MODULE_CATEGORIES.find((option) => option === category) || null;
}
