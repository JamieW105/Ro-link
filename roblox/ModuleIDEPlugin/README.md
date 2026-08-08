# Ro-Link Module IDE Studio Plugin

This is a standalone Studio plugin for the browser Module IDE. It intentionally
does not depend on or modify the existing Ro-Link installer plugin.

The plugin provides:

- Ro-Link account authorization through the existing scoped plugin session flow.
- One-time, module-specific pairing with `/dashboard/modules/ide`.
- A dock widget with connection, pairing, UI import, resync, browser-open, and disconnect controls.
- Initial and incremental Studio Explorer synchronization.
- Lazy child loading.
- Script reading and revision-aware `ScriptEditorService:UpdateSourceAsync` writes.
- Conflict responses when Studio has changed since a browser tab was opened.
- Whitelist-based Roblox UI hierarchy serialization.
- Validated Module Project v2 download and one-click materialization into the current place.
- Server, client, and shared ModuleScripts, reconstructed UI, module-scoped remotes, and generated lifecycle runners.
- Batched HTTPS polling with versioned, validated message types.

`PluginMain.luau` is the source of truth. Package it as a Studio plugin script;
the repository build helper creates a local `.rbxmx` without touching the older
Ro-Link installer plugin.
