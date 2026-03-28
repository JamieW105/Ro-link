export interface AdminPanelCommandDefinition {
    id: string;
    label: string;
    description: string;
    category: string;
    requiresTarget?: boolean;
}

export const ADMIN_PANEL_COMMANDS: AdminPanelCommandDefinition[] = [
    { id: 'KICK', label: 'Kick', description: 'Remove a player from the live server.', category: 'Moderation', requiresTarget: true },
    { id: 'BAN', label: 'Ban', description: 'Permanently ban a Roblox user.', category: 'Moderation', requiresTarget: true },
    { id: 'UNBAN', label: 'Unban', description: 'Lift an existing Roblox ban.', category: 'Moderation', requiresTarget: true },
    { id: 'SOFTBAN', label: 'Soft Ban', description: 'Temporarily ban and remove a user.', category: 'Moderation', requiresTarget: true },
    { id: 'FLY', label: 'Fly', description: 'Toggle flight for a player.', category: 'Effects', requiresTarget: true },
    { id: 'NOCLIP', label: 'Noclip', description: 'Toggle collisions for a player.', category: 'Effects', requiresTarget: true },
    { id: 'INVIS', label: 'Invisible', description: 'Toggle invisibility for a player.', category: 'Effects', requiresTarget: true },
    { id: 'GHOST', label: 'Ghost', description: 'Toggle ghost rendering for a player.', category: 'Effects', requiresTarget: true },
    { id: 'HEAL', label: 'Heal', description: 'Restore a player to full health.', category: 'Player', requiresTarget: true },
    { id: 'KILL', label: 'Kill', description: 'Set a player’s health to zero.', category: 'Player', requiresTarget: true },
    { id: 'RESET', label: 'Reset', description: 'Respawn a player character.', category: 'Player', requiresTarget: true },
    { id: 'REFRESH', label: 'Refresh', description: 'Reload a player while preserving position.', category: 'Player', requiresTarget: true },
    { id: 'SET_CHAR', label: 'Set Character', description: 'Copy another avatar onto the target.', category: 'Player', requiresTarget: true },
    { id: 'DAMAGE', label: 'Damage', description: 'Deal a chosen amount of damage.', category: 'Player', requiresTarget: true },
    { id: 'MAX_HEALTH', label: 'Max Health', description: 'Set a player’s maximum health.', category: 'Player', requiresTarget: true },
    { id: 'WALK_SPEED', label: 'Walk Speed', description: 'Set a player’s walk speed.', category: 'Player', requiresTarget: true },
    { id: 'JUMP_POWER', label: 'Jump Power', description: 'Set a player’s jump power.', category: 'Player', requiresTarget: true },
    { id: 'FREEZE', label: 'Freeze', description: 'Anchor a player in place.', category: 'Player', requiresTarget: true },
    { id: 'UNFREEZE', label: 'Unfreeze', description: 'Remove an active freeze.', category: 'Player', requiresTarget: true },
    { id: 'BRING_TO_SPAWN', label: 'Bring To Spawn', description: 'Move a player to spawn.', category: 'Player', requiresTarget: true },
    { id: 'TELEPORT_TO_ME', label: 'Teleport To Me', description: 'Move a player to the moderator.', category: 'Player', requiresTarget: true },
    { id: 'FORCEFIELD_ADD', label: 'Add ForceField', description: 'Add a ForceField to a player.', category: 'Player', requiresTarget: true },
    { id: 'FORCEFIELD_REMOVE', label: 'Remove ForceField', description: 'Remove active ForceFields.', category: 'Player', requiresTarget: true },
    { id: 'BROADCAST', label: 'Broadcast', description: 'Send a server-wide admin message.', category: 'World' },
    { id: 'GRAVITY', label: 'Gravity', description: 'Set workspace gravity.', category: 'World' },
    { id: 'BRIGHTNESS', label: 'Brightness', description: 'Set lighting brightness.', category: 'World' },
    { id: 'UPDATE', label: 'Update Server', description: 'Kick players for a live update.', category: 'Server' },
    { id: 'SHUTDOWN', label: 'Shutdown Server', description: 'Close the current live server.', category: 'Server' },
];

export const ADMIN_PANEL_COMMAND_GROUPS = ADMIN_PANEL_COMMANDS.reduce<Array<{ category: string; commands: AdminPanelCommandDefinition[] }>>((groups, command) => {
    const existing = groups.find((group) => group.category === command.category);
    if (existing) {
        existing.commands.push(command);
    } else {
        groups.push({
            category: command.category,
            commands: [command],
        });
    }
    return groups;
}, []);

export const ADMIN_PANEL_COMMAND_IDS = ADMIN_PANEL_COMMANDS.map((command) => command.id);

export const MISC_ACTION_COMMAND_IDS = ['FLY', 'NOCLIP', 'INVIS', 'GHOST', 'HEAL', 'KILL', 'RESET', 'REFRESH', 'SET_CHAR'] as const;

const KNOWN_COMMAND_IDS = new Set<string>(ADMIN_PANEL_COMMAND_IDS);

const COMMAND_ALIASES: Record<string, string> = {
    SOFT_BAN: 'SOFTBAN',
    SETCHAR: 'SET_CHAR',
    SET_CHARACTER: 'SET_CHAR',
    NO_CLIP: 'NOCLIP',
    MAXHEALTH: 'MAX_HEALTH',
    WALKSPEED: 'WALK_SPEED',
    JUMPPOWER: 'JUMP_POWER',
    TELEPORTTOME: 'TELEPORT_TO_ME',
    BRINGTOSPAWN: 'BRING_TO_SPAWN',
    FORCEFIELDADD: 'FORCEFIELD_ADD',
    FORCEFIELDREMOVE: 'FORCEFIELD_REMOVE',
};

export function normalizeAdminPanelCommand(rawCommand: unknown): string {
    const normalized = String(rawCommand ?? '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');

    if (normalized === '*') {
        return '*';
    }

    return COMMAND_ALIASES[normalized] || normalized;
}

export function normalizeAdminPanelCommandList(rawCommands: unknown): string[] {
    if (!Array.isArray(rawCommands)) {
        return [];
    }

    const commands = new Set<string>();

    for (const rawCommand of rawCommands) {
        const command = normalizeAdminPanelCommand(rawCommand);
        if (!command) {
            continue;
        }
        if (command === '*') {
            return ['*'];
        }
        if (KNOWN_COMMAND_IDS.has(command)) {
            commands.add(command);
        }
    }

    return ADMIN_PANEL_COMMAND_IDS.filter((commandId) => commands.has(commandId));
}

export function hasAdminPanelCommandAccess(rawCommands: unknown, commandId: string) {
    const commands = normalizeAdminPanelCommandList(rawCommands);
    const normalizedCommand = normalizeAdminPanelCommand(commandId);
    return commands.includes('*') || commands.includes(normalizedCommand);
}

export function hasAnyAdminPanelCommand(rawCommands: unknown, commandIds?: readonly string[]) {
    const commands = normalizeAdminPanelCommandList(rawCommands);
    if (commands.includes('*')) {
        return true;
    }
    if (!commandIds || commandIds.length === 0) {
        return commands.length > 0;
    }

    const subset = new Set(commandIds.map((commandId) => normalizeAdminPanelCommand(commandId)));
    return commands.some((commandId) => subset.has(commandId));
}
