import {
    ADMIN_PANEL_COMMAND_IDS,
    normalizeAdminPanelCommand,
    type AdminPanelCommandDefinition,
    type AdminPanelCommandFieldDefinition,
} from './adminPanelCommands';

const BUILT_IN_COMMANDS = new Set(ADMIN_PANEL_COMMAND_IDS);
const MAX_MODULE_PANEL_COMMANDS = 100;
const MAX_MODULE_PANEL_FIELDS = 20;

function trimString(value: unknown, maxLength = 500) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function readRecordValue(record: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
        if (record[key] !== undefined) {
            return record[key];
        }
    }
    return undefined;
}

function readBoolean(record: Record<string, unknown>, fallback: boolean, ...keys: string[]) {
    const value = readRecordValue(record, ...keys);
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return fallback;
}

function normalizeField(rawField: unknown): AdminPanelCommandFieldDefinition | null {
    if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) {
        return null;
    }

    const record = rawField as Record<string, unknown>;
    const id = trimString(readRecordValue(record, 'id', 'Id', 'key', 'Key', 'name', 'Name'), 80);
    if (!id) {
        return null;
    }

    return {
        id,
        label: trimString(readRecordValue(record, 'label', 'Label', 'title', 'Title'), 120) || id,
        type: trimString(readRecordValue(record, 'type', 'Type'), 40) || undefined,
        required: readBoolean(record, false, 'required', 'Required'),
        multiline: readBoolean(record, false, 'multiline', 'Multiline', 'multiLine', 'MultiLine'),
    };
}

export function normalizeModulePanelCommandDefinition(rawCommand: unknown): AdminPanelCommandDefinition | null {
    if (!rawCommand || typeof rawCommand !== 'object' || Array.isArray(rawCommand)) {
        return null;
    }

    const record = rawCommand as Record<string, unknown>;
    const id = normalizeAdminPanelCommand(readRecordValue(
        record,
        'id',
        'Id',
        'commandId',
        'CommandId',
        'name',
        'Name',
        'commandName',
        'CommandName',
        'command',
        'Command',
    ));
    if (!id || id === '*' || BUILT_IN_COMMANDS.has(id)) {
        return null;
    }

    const rawFields = readRecordValue(record, 'fields', 'Fields');
    const fields = Array.isArray(rawFields)
        ? rawFields.map(normalizeField).filter((field): field is AdminPanelCommandFieldDefinition => Boolean(field)).slice(0, MAX_MODULE_PANEL_FIELDS)
        : [];
    const sortOrder = Number(readRecordValue(record, 'sortOrder', 'SortOrder'));

    return {
        id,
        label: trimString(readRecordValue(record, 'label', 'Label', 'title', 'Title'), 120) || id.replace(/_/g, ' '),
        description: trimString(readRecordValue(record, 'description', 'Description'), 500)
            || 'Run a command registered by a marketplace module.',
        category: trimString(readRecordValue(record, 'category', 'Category'), 80) || 'Module',
        requiresTarget: readBoolean(record, false, 'requiresTarget', 'RequiresTarget', 'targetRequired', 'TargetRequired'),
        source: 'module',
        moduleId: trimString(readRecordValue(record, 'moduleId', 'ModuleId', 'module_id'), 120) || undefined,
        moduleName: trimString(readRecordValue(record, 'moduleName', 'ModuleName', 'module_name'), 120) || undefined,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        fields,
    };
}

function readLiveServerCommands(liveServer: unknown) {
    if (!liveServer || typeof liveServer !== 'object' || Array.isArray(liveServer)) {
        return [];
    }

    const record = liveServer as Record<string, unknown>;
    const rawCommands = readRecordValue(record, 'module_panel_commands', 'modulePanelCommands');
    if (Array.isArray(rawCommands)) {
        return rawCommands;
    }
    if (rawCommands && typeof rawCommands === 'object') {
        return Object.values(rawCommands as Record<string, unknown>);
    }
    return [];
}

export function collectModulePanelCommandsFromLiveServers(liveServers: unknown[]): AdminPanelCommandDefinition[] {
    const commandsById = new Map<string, AdminPanelCommandDefinition>();

    for (const liveServer of liveServers) {
        for (const rawCommand of readLiveServerCommands(liveServer)) {
            const command = normalizeModulePanelCommandDefinition(rawCommand);
            if (!command || commandsById.has(command.id)) {
                continue;
            }
            commandsById.set(command.id, command);
            if (commandsById.size >= MAX_MODULE_PANEL_COMMANDS) {
                break;
            }
        }
        if (commandsById.size >= MAX_MODULE_PANEL_COMMANDS) {
            break;
        }
    }

    return Array.from(commandsById.values()).sort((left, right) => (
        (left.sortOrder ?? 1000) - (right.sortOrder ?? 1000)
        || left.category.localeCompare(right.category)
        || left.label.localeCompare(right.label)
    ));
}
