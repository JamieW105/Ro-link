# Ro-Link Custom Module API

This document is the implementation contract for the in-game Ro-Link admin panel and module runtime. It explains every custom module entrypoint, callback, context field, helper, command definition, payload, and compatibility alias that the panel is expected to understand.

It is written for the person building or replacing the in-game panel. Module authors can also use it to understand what the panel will call.

## 1. Runtime responsibilities

The in-game runtime must:

1. Discover installed `ModuleScript` instances under `ReplicatedStorage["RoLink Admin"]["Custom Modules"]`.
2. Match each instance to its Ro-Link module metadata by ID, slug, name, checksum, or installed attributes.
3. `require()` each module safely with `pcall`.
4. Build a fresh, module-scoped `context` table.
5. register its commands, panel commands, lifecycle hooks, live-config actions, and server/client transport handlers;
6. expose panel command metadata to Ro-Link in the live-server poll;
7. call the correct handler when a command or panel event occurs;
8. catch and namespace every module error so one module cannot stop the admin panel;
9. remove old bindings when a module is removed or its checksum/version changes; and
10. never trust client-supplied permissions, targets, module IDs, or payloads.

The runtime should treat module code as an extension, not as part of the panel itself. A failing module must be isolated and logged while the core panel continues running.

## 2. Two module runtime shapes exist

Ro-Link currently has two related module shapes.

### Installed admin-panel modules

These are readable `ModuleScript` instances installed below `ReplicatedStorage["RoLink Admin"]["Custom Modules"]`. They use `Init`, `Commands`, `PanelCommands`, live config, panel hooks, report helpers, Discord helpers, `CreateUI`, and player helpers. Most of this document describes this runtime.

### Module IDE v2 projects

These have separate server and client entrypoints declared by `module.json`. They add `Start`, `Destroy`, `CallClient`, and `CallServer`, and run with a context-specific service whitelist. A new admin panel should support this transport when it hosts v2 packages.

Do not assume that a helper appearing in editor autocomplete means the installed admin-panel runner already implements it. See [Current implementation differences](#17-current-implementation-differences).

## 3. Loading a module

An installed module may return either a function or a table.

```lua
-- Function shorthand: treat this as Init.
return function(context, settings)
    context.Log("Loaded")
end
```

```lua
-- Full module definition.
return {
    Init = function(context, settings)
        context.Log("Loaded")
    end,

    Commands = {},
    PanelCommands = {},
    LiveConfig = {},
}
```

Panel handling rules:

- If `require()` returns a function, convert it to `{ Init = returnedFunction }`.
- If it returns a table, inspect the supported members below.
- If it returns any other value, warn and skip it.
- Load declarative command and hook tables before calling `Init`.
- Call `Init` with `pcall`.
- If `Init` throws, remove every command and hook already registered for that module and mark startup as failed.
- Use a stable module key, preferably slug then ID. Track the source checksum or version so unchanged modules are not initialized repeatedly.
- On replacement or removal, clear all old commands, definitions, module metadata, hooks, UI bindings, remote connections, and loaded state owned by that module.

## 4. Module exports the panel must handle

### `Init`

```lua
Init(context: ModuleContext, settings: { [string]: any }): any
```

Called once after the module has been required and its declarative command/hook tables have been registered.

- `context` is the module-scoped API described later.
- `settings` is the current server's saved settings table.
- The return value is not currently used.
- An error means module startup failed. The panel must unregister partial bindings.
- `Init` may call registration functions such as `RegisterPanelCommand`.

### `Start` (Module IDE v2)

```lua
Start(context: ModuleContext, settings: { [string]: any }): any
```

Called after `Init` by the v2 server or client runner. It is useful when a module wants initialization and activation to be separate stages. Call it with `pcall`; an error should be namespaced to the module.

### `Destroy` (Module IDE v2 server)

```lua
Destroy(context: ModuleContext, settings: { [string]: any }): any
```

Called during `game:BindToClose()` by the v2 server runner. Use it for best-effort cleanup or flushing. It must not be relied upon for critical persistence because shutdown callbacks have limited time and are not guaranteed in every crash condition.

### `Commands`

```lua
Commands: { [string]: (command: CommandPayload, context: ModuleContext, args: table) -> any }
```

Each key is registered as a command name.

```lua
return {
    Commands = {
        hello = function(command, context, args)
            context.Log("Hello", args.username)
        end,
    },
}
```

Handling:

- Normalize command names by converting to a string, replacing spaces/hyphens with `_`, and uppercasing. `hello-world` becomes `HELLO_WORLD`.
- Store the handler together with the owning module key and metadata.
- Invoke it as `handler(command, freshContext, command.args)` inside `pcall`.
- `command.args` must always be a table; use `{}` when missing.
- A same-name registration currently replaces the older registration. A stronger implementation should warn about collisions and use a deterministic ownership rule.

### `PanelCommands`

```lua
PanelCommands: { [string]: function | PanelCommandDefinition }
```

A value can be a handler function:

```lua
PanelCommands = {
    ping = function(command, context, args)
        context.Log("Ping")
    end,
}
```

Or a definition table containing `Handler`/`handler`:

```lua
PanelCommands = {
    note_report = {
        Name = "note_report",
        Title = "Note Report",
        Description = "Add a moderator note.",
        Category = "Reports",
        TargetRequired = false,
        SortOrder = 10,
        Fields = {
            { id = "reportId", label = "Report ID", required = true },
            { id = "note", label = "Note", required = true, multiline = true },
        },
        Handler = function(command, context, args)
            return context.UpdateReport(args.reportId, {
                moderatorNote = args.note,
            })
        end,
    },
}
```

For a bare function, synthesize a definition using the table key as name/title, category `Marketplace`, no target, and no fields. For a table, use the map key as `Name` only when the table does not already supply a name.

### `OnAdminPanelOpened` / `AdminPanelOpened`

```lua
OnAdminPanelOpened(player: Player, payload: table, context: ModuleContext): ()
```

Runs after an authorized player opens the main in-game admin panel. `AdminPanelOpened` is a compatibility alias. If both are present, prefer `OnAdminPanelOpened` and call it only once.

The panel must fire this hook on the server, not from arbitrary client code. Recommended `payload` fields are:

```lua
{
    source = "admin-panel",
    openedAt = os.time(),
    panelVersion = "1.0.0",
    tab = "home", -- optional
}
```

Only fire after the server has confirmed that `player` can use the panel. Call each module hook independently with `pcall`.

### `OnCommandBarOpened` / `CommandBarOpened`

```lua
OnCommandBarOpened(player: Player, payload: table, context: ModuleContext): ()
```

Runs when an authorized player opens the Cmds/command-bar surface. `CommandBarOpened` is a compatibility alias. Recommended payload:

```lua
{
    source = "command-bar",
    openedAt = os.time(),
    panelVersion = "1.0.0",
    query = "", -- optional current search
}
```

Opening the main panel and opening the command bar are separate events. Do not fire both automatically unless the user actually opened both surfaces.

### `LiveConfig`, `LiveActions`, and `Live`

```lua
LiveConfig: { [string]: (command, context, value, fieldKey) -> any }
LiveActions: { [string]: (command, context, value, fieldKey) -> any }
Live: { [string]: (command, context, value, fieldKey) -> any }
```

These three names are aliases for tables of handlers triggered by the special `MODULE_LIVE` delivery command. Search them in the order `LiveConfig`, `LiveActions`, then `Live`; the first function matching `field_key` or `field_label` handles the action.

```lua
LiveConfig = {
    Announcement = function(command, context, value, fieldKey)
        for _, player in ipairs(context.GetPlayers()) do
            context.Notify(player, tostring(value), true)
        end
    end,
}
```

The runtime must select the installed module by `args.module_id` or `args.module_slug`, then pass:

- the complete delivery command;
- a fresh module context;
- `args.value` (which may be a primitive or a table for a multi-input form); and
- `args.field_key`.

### `OnLiveConfig`

```lua
OnLiveConfig(command, context, value, fieldKey): any
```

Fallback for `MODULE_LIVE` when no matching function was found in the three live-action tables. It receives the same four arguments.

### `CallClient` handler (Module IDE v2 client)

```lua
CallClient(context: ModuleContext, ...: any): ()
```

Called on the selected player's client when server module code calls `context.CallClient(ModuleID, player, ...)`. The transport removes the routing module ID before invoking the handler.

### `CallServer` handler (Module IDE v2 server)

```lua
CallServer(context: ModuleContext, player: Player, ...: any): ()
```

Called on the server when client module code calls `context.CallServer(ModuleID, ...)`. The server must supply the real sending `Player`; a client must never be allowed to choose or spoof it.

The current v2 runner accepts at most 60 incoming calls per player per 10-second window. Calls beyond that limit are dropped and warned. This is only a coarse transport limit: every handler must still validate argument types, sizes, permissions, ownership, and game state.

## 5. The module context

Create a new or refreshed context when invoking commands and hooks. Do not expose the server API key in it.

### `context.ModuleId`

```lua
context.ModuleId: string
```

The current module's immutable ID. Required by v2 modules so they can call their own client or server handler. The installed legacy context may obtain the same value from `context.Module.id`, but a unified panel should provide both.

### `context.Module`

```lua
context.Module: table
```

Published module metadata/manifest. Common fields include `id`, `slug`, `name`, `version`, `description`, `sourceChecksum`, `configSchema` or `configuration`, `settings`, `entrypoints`, `capabilities`, and `dependencies`, depending on package generation.

Treat it as read-only. Do not let a module overwrite the runtime's canonical metadata.

### `context.Config`

```lua
context.Config: { [string]: ConfigFieldDefinition }
```

The configuration schema, not the saved values. It describes fields such as type, default, options, live behavior, labels, and sub-inputs.

The installed runtime refreshes config metadata from `/api/v1/game-admin/modules?configOnly=1`. A panel can implement `Config` as a fresh proxy, but it should cache sensibly rather than issuing an HTTP request for every property read.

### `context.Settings`

```lua
context.Settings: { [string]: any }
```

The saved, per-Discord-server values selected in the Ro-Link dashboard. Live fields are actions and are not necessarily stored here. Client-side settings are presentation data only and must never be permission authority.

### `context.GetConfig()`

```lua
context.GetConfig(): table
```

Returns the latest complete config schema after refreshing module metadata. This exists in the installed runner even though it is not currently listed in editor autocomplete.

### `context.GetSettings()`

```lua
context.GetSettings(): table
```

Returns the latest complete saved-settings table after refreshing module metadata.

### `context.RefreshConfig()`

```lua
context.RefreshConfig(): ModuleMetadata
```

Refreshes the module's config-only metadata and merges it into the in-memory module record without replacing source code. Return the updated module metadata.

### `context.Services`

```lua
context.Services.<ServiceName>: RobloxService
```

Use a whitelist rather than exposing unrestricted dynamic service access. The v2 runner currently recognizes:

| Service | Server | Client |
| --- | ---: | ---: |
| `Players` | yes | yes |
| `ReplicatedStorage` | yes | yes |
| `RunService` | yes | yes |
| `ServerStorage` | yes | no |
| `ServerScriptService` | yes | no |
| `StarterGui` | yes | yes |
| `StarterPlayer` | yes | yes |
| `TweenService` | yes | yes |
| `UserInputService` | no | yes |
| `CollectionService` | yes | yes |
| `DataStoreService` | yes | no |
| `HttpService` | yes | yes |
| `Lighting` | yes | yes |
| `MarketplaceService` | yes | yes |
| `MessagingService` | yes | no |
| `SoundService` | yes | yes |
| `TextChatService` | yes | yes |

Attempting to access a disallowed service should throw a module-namespaced error. `Workspace` may be exposed explicitly for legacy compatibility; if it is, document it and keep the server/client security boundary intact.

### `context.RoLink`

```lua
context.RoLink: internal runtime object
```

The installed runner currently exposes its complete core object. New panel code should avoid making this a supported public API because it lets modules depend on internal methods and mutable state. Keep it only for backward compatibility, or replace it with a narrow read-only facade.

## 6. Command registration APIs

### `context.RegisterCommand`

```lua
context.RegisterCommand(commandName: string, handler: function): ()
```

Registers a module command. Current installed behavior also creates a default panel definition and marks it panel-visible.

Default definition:

```lua
{
    Id = NORMALIZED_NAME,
    Name = commandName,
    Title = commandName,
    Description = "Registered by <module>",
    Category = "Marketplace",
    TargetRequired = false,
    Fields = {},
}
```

Ignore invalid calls where the name is not a string or the handler is not a function. Prefer returning `false, message` or warning so mistakes are visible rather than silently doing nothing.

### `context.RegisterPanelCommand`

```lua
context.RegisterPanelCommand(definition: PanelCommandDefinition, handler: function): ()
```

Registers both execution behavior and metadata for the Cmds UI. This is the preferred API for commands intended to be discoverable.

Accepted definition names and aliases:

| Meaning | Accepted keys |
| --- | --- |
| command ID/name | `Name`, `name`, `Command`, `command`, `Id`, `id` |
| display label | `Title`, `title`, `Label`, `label`, then name |
| help text | `Description`, `description` |
| group | `Category`, `category` |
| target required | `TargetRequired`, `targetRequired`, `RequiresTarget`, `requiresTarget` |
| order | `SortOrder`, `sortOrder` |
| custom inputs | `Fields`, `fields` |

Panel-side normalization limits used by the web application:

- command ID is normalized to uppercase with spaces/hyphens converted to `_`;
- built-in IDs and `*` are rejected as module command definitions;
- strings are trimmed and capped: ID 80, label 120, description 500, category 80, module ID/name 120;
- no more than 20 fields per command;
- no more than 100 distinct module commands are collected across live servers;
- duplicate IDs keep the first fresh live-server definition;
- final order is `sortOrder` (default 1000), category, then label.

### `context.RegisterCommandInPanel`

```lua
context.RegisterCommandInPanel(definition: string | PanelCommandDefinition, handler: function): ()
```

Compatibility helper. A string is expanded into the default marketplace definition. A table is handled like `RegisterPanelCommand`.

### `context.RegisterCommandBar` and `context.RegisterCmdsBar`

```lua
context.RegisterCommandBar(definition, handler): ()
context.RegisterCmdsBar(definition, handler): ()
```

Compatibility aliases of `RegisterCommandInPanel`. New modules should use `RegisterPanelCommand`.

## 7. Panel command definitions and fields

Canonical definition:

```lua
export type PanelCommandDefinition = {
    Name: string,
    Title: string?,
    Description: string?,
    Category: string?,
    TargetRequired: boolean?,
    SortOrder: number?,
    Fields: { PanelCommandField }?,
}
```

Canonical field:

```lua
export type PanelCommandField = {
    id: string,
    label: string?,
    type: string?,
    required: boolean?,
    multiline: boolean?,
}
```

Field aliases accepted by the normalizer:

- ID: `id`, `Id`, `key`, `Key`, `name`, `Name`
- label: `label`, `Label`, `title`, `Title`
- type: `type`, `Type`
- required: `required`, `Required`
- multiline: `multiline`, `Multiline`, `multiLine`, `MultiLine`

Unknown field types currently survive as strings. A robust in-game panel should support at least `string`/text, `number`/integer, `boolean`, `player`, and `server`, and fall back to a text box for unknown types. `multiline = true` should render a multi-line input. Validate `required` fields before delivery.

The submitted values must be placed in `command.args` under the exact field IDs. Preserve their types when using form controls. Do not lowercase or rename custom field IDs.

For command-bar text parsing, Ro-Link's dashboard accepts quoted tokens, `field=value`, and positional values. The last field receives remaining positional text. An in-game panel may mirror this behavior, but structured form submission is preferred.

### Publishing definitions to Ro-Link

Every server poll should include:

```lua
modulePanelCommands = {
    {
        id = "FLAG_REPORT",
        name = "flag_report",
        label = "Flag Report",
        description = "Add a moderator note.",
        category = "Reports",
        requiresTarget = false,
        sortOrder = 10,
        moduleId = "module-id-or-slug",
        moduleName = "Module Name",
        fields = {
            {
                id = "note",
                label = "Note",
                type = "string",
                required = true,
                multiline = true,
            },
        },
    },
}
```

The poll endpoint stores this as `live_servers.module_panel_commands`. Only recently updated servers (currently five minutes) advertise executable module commands to the game-admin command API.

## 8. Command execution payload

A registered handler receives:

```lua
handler(command, context, args)
```

Typical `command` shape:

```lua
{
    command = "FLAG_REPORT", -- normalized
    args = {
        username = "TargetPlayer",       -- target when required
        target_label = "TargetPlayer",   -- optional display identity
        moderator = "Moderator label",
        moderator_roblox_username = "ModPlayer",
        source_job_id = "...",
        job_id = "...",                  -- delivery server
        reportId = "...",                -- custom field
        note = "...",                    -- custom field
    },
}
```

Handling rules:

- Normalize `command.command` before lookup.
- Replace a missing/non-table `args` with `{}`.
- For `TargetRequired`, require a usable identity before queueing. Ro-Link accepts `username`, `targetName`, `userIdentity`, or `target_label` when validating a module command.
- Delivery may be routed to a preferred source job, the live server containing the target, or multiple live servers for non-targeted module commands.
- The handler return value is currently ignored by the installed runner. A better panel may interpret `(true, message/data)` and `(false, error)` for feedback, but must remain compatible with handlers that return nothing.
- Execute through `pcall`; warn with the command and module name on failure.
- Never retry a state-changing handler automatically unless the command has a delivery ID/idempotency key.

## 9. Panel lifecycle registration APIs

### `context.OnAdminPanelOpened`

```lua
context.OnAdminPanelOpened(handler: function): ()
```

Register `handler` under the current module key. Ignore or reject non-functions. When fired, invoke:

```lua
handler(player, payload or {}, freshModuleContext)
```

### `context.OnCommandBarOpened`

Same handling, registered under a separate `CommandBarOpened` hook list.

Do not let one hook prevent later hooks from running. Each callback needs its own `pcall`. Clear registrations when the module reloads.

## 10. Server/client Module API transport

### `context.CallClient`

```lua
context.CallClient(ModuleID: string, user: Player, ...: any): ()
```

Server-only. Validate that `user` is a live `Player`, require a non-empty target module ID, then route only to that player's client. The client runner invokes the target package's exported `CallClient(context, ...)`.

### `context.CallServer`

```lua
context.CallServer(ModuleID: string, ...: any): ()
```

Client-only. Require a non-empty target module ID and fire the server transport. The server runner invokes `CallServer(context, sendingPlayer, ...)` only when the target ID matches that runner.

Required security:

- Create/own the transport centrally; modules must not supply arbitrary remote instances.
- Never broadcast a `CallClient` payload to other players.
- Enforce server rate limits per player and preferably per module.
- Cap argument count and serialized payload size.
- Reject Roblox instances that the receiver should not see or control.
- Validate the target package is installed and enabled.
- Do not treat knowledge of a module ID as authorization.
- Log rejected calls without exposing secrets or full sensitive payloads.

## 11. Discord and user-data helpers

All web helpers use the running server's Ro-Link API key internally. The module must never receive that key. Their common convention is:

```lua
local ok, resultOrError = context.SomeHelper(...)
```

On HTTP/network/validation failure, return `false, message`. Module authors should not need to parse raw HTTP responses.

### `context.SendBotMessage`

```lua
context.SendBotMessage(
    target: "channel" | "serverowner" | "user" | "dm" | "member",
    user: any?,
    channelId: string?,
    content: BotMessageContent
): (boolean, any)
```

Destinations:

- `channel`: `channelId` must belong to the connected Discord server and the bot must be able to send there.
- `serverowner` (also accepted by the web API as `server_owner` or `owner`): resolve the Discord server owner and open a DM.
- `user`, `dm`, or `member`: resolve a Discord user ID, verify that user is a member of the connected server, then open a DM.

A Roblox `Player` passed as `user` is normalized to `{ robloxUserId, username, displayName }`, but DM delivery ultimately requires a Discord identity. Prefer data obtained from `GetUserData`.

Content may be plain text, an embed, or both:

```lua
local ok, result = context.SendBotMessage("channel", nil, channelId, {
    PlainText = "Plain message",
    Embed = {
        Title = "Optional title",
        Content = "Embed body",
        media = "https://example.com/image.png",
        Footer = "Footer",
        icon = "https://example.com/icon.png",
        Color = 0x38bdf8,
    },
})
```

Compatibility input names are normalized by the server. `content`/`message` can be used for plain content, and both `Footer` and the historical typo `Footor` are accepted. The panel should pass the module ID/slug for observability but must let the web API validate the destination.

### `context.GetDiscordChannels`

```lua
context.GetDiscordChannels(): (boolean, { DiscordChannel })
```

Returns only channels from the connected Discord server that the bot can send to. Do not cache indefinitely because channel permissions can change. The underlying response also contains `serverId`; the helper returns only `channels`.

### `context.GetUserData`

```lua
context.GetUserData(user: Player | string | number | table): (boolean, UserData)
```

Accepted input:

- live `Player`;
- Roblox username string;
- numeric or numeric-string Roblox UserId;
- `{ robloxId = ... }`;
- `{ robloxUsername = ... }`; or
- `{ discordId = ... }`.

Important result sections:

```lua
{
    serverId = "...",
    linked = true,
    user = {
        robloxId = "...",
        robloxUsername = "...",
        displayName = "...",
        description = "...",
        createdAt = "...",
        robloxBanned = false,
    },
    verifiedUser = { discordId = "...", robloxId = "...", robloxUsername = "..." },
    discordUser = { id = "...", username = "...", globalName = "..." },
    discordUsers = {},
    discordMember = { nick = "...", joinedAt = "...", roleIds = {} },
    serverRank = {
        highestPosition = 0,
        highestRole = nil,
        roles = {},
        isOwner = false,
        isAdmin = false,
        inServer = true,
    },
    permissions = {},
    logs = {},
    pastModeration = {},
    roles = { roLinkStaff = false, dgsuBanned = false, serverStaff = false },
    dgsu = {},
    presence = { inGame = false, jobId = nil, player = nil, game = nil },
}
```

Missing Discord linkage is a successful lookup with `linked = false`, not necessarily an error. Never grant permission from client-cached user data; permissions must be checked on the server at action time.

## 12. Report helpers

Report access is always scoped to the Discord server attached to the running Roblox server.

### `context.GetReports`

```lua
context.GetReports(options: ReportQuery?): (boolean, { Report })
```

Options:

- `status`: `PENDING`, `RESOLVED`, `DISMISSED`, or `ALL`;
- `limit`: 1-100, default 50;
- `target`: partial/case-insensitive reported Roblox username; and
- `reporter`: exact reporter Discord ID.

Returns reports newest first.

### `context.GetReport`

```lua
context.GetReport(reportId: string): (boolean, Report)
```

Requires a non-empty report UUID. Returns `false, "Report ID is required."` before making a request when missing. The web API also verifies the report belongs to the current server.

### `context.CreateReport`

```lua
context.CreateReport(body: CreateReportInput): (boolean, any)
```

Accepted fields and aliases:

| Purpose | Accepted input |
| --- | --- |
| target | `reportedRobloxUsername`, `reported_roblox_username`, `target` |
| reason | `reason`, `message` |
| reporter Discord ID | `reporterDiscordId`, `reporter_discord_id`, `discordId` |
| reporter Roblox name | `reporterRobloxUsername`, `reporter_roblox_username` |
| reporter live job | `reporterLiveServerId`, `reporter_live_server_id`, `jobId`, `job_id` |

Target and reason are required. The installed runtime defaults `reporterLiveServerId` to `game.JobId`. The API always creates the report with `PENDING` status and snapshots relevant live-server/join context. It defaults a missing reporter Discord ID to `rolink-module`.

Note: unlike `GetReport` and `UpdateReport`, the current installed wrapper returns the complete web payload (`{ serverId, report }`) rather than extracting only `report`. Panel implementations should preserve this behavior for compatibility or version the correction.

### `context.UpdateReport`

```lua
context.UpdateReport(reportId: string, updates: UpdateReportInput): (boolean, Report)
```

Editable fields:

- `status`: `PENDING`, `RESOLVED`, or `DISMISSED`;
- `moderatorNote` / `moderator_note`;
- `moderatorId` / `moderator_id`;
- `reason` (cannot be empty);
- `reportedRobloxUsername` / `reported_roblox_username` / `target`; and
- `reporterRobloxUsername` / `reporter_roblox_username`.

At least one editable field is required. Resolving/dismissing sets `resolved_at`; returning to pending clears it. The API also writes an action log.

## 13. Player and feedback helpers

### `context.FindPlayer`

```lua
context.FindPlayer(target: Player | string | number): Player?
```

Match a live `Player` instance directly, exact username, or exact UserId. Numeric strings are treated as UserIds after exact-name lookup. This is intentionally a live-server lookup; it does not perform a Roblox-wide search.

### `context.GetPlayers`

```lua
context.GetPlayers(): { Player }
```

Return the current `Players:GetPlayers()` list. Return an empty array, never `nil`, when nobody is connected.

### `context.Notify`

```lua
context.Notify(
    target: Player | string | number,
    message: string,
    success: boolean?
): (boolean, string?)
```

Display module feedback through the panel's trusted server-to-client feedback remote.

- Resolve only live players.
- `success == true` means success styling; `false` means error styling; `nil` means neutral/info.
- Cap message length and rate-limit modules so notifications cannot flood clients.
- Return a useful success/failure pair.
- Do not allow a module to choose arbitrary client remotes.

### `context.Log`

```lua
context.Log(...: any): ()
```

Print a line prefixed with the module ID/name, for example `[Ro-Link Module my-module]`. Avoid logging the server API key, tokens, private report contents, or full untrusted payloads.

### `context.Warn` (Module IDE v2)

```lua
context.Warn(...: any): ()
```

Same namespacing as `Log`, using `warn`.

## 14. Module-created UI

### `context.CreateUI`

```lua
context.CreateUI(
    target: Player | string | number | { any },
    functionOrTree: function | UiTree,
    props: table?
): any
```

If only one argument is supplied, treat it as `functionOrTree` and target all players. Target strings `all`, `server`, and `everyone` mean every current player. A target list should resolve each supported identity and de-duplicate players.

#### Builder function

The current installed runner calls:

```lua
functionOrTree({
    Player = player,
    PlayerGui = playerGui,
    Module = latestModuleInfo,
    Config = latestConfig,
    Settings = latestSettings,
}, player, props or {})
```

The callback should return a GUI `Instance`. If it returns an unparented `ScreenGui`, parent it to `PlayerGui` and set `ResetOnSpawn = false`. If it returns another unparented GUI object, create a namespaced `ScreenGui`, parent the result under it, and use `ZIndexBehavior.Sibling`.

Some examples use `function(ui) ui.Create(...)`. A unified new panel should provide `ui.Create(className, properties, children?)` while retaining the fields above, because current documentation and current runner are not fully aligned.

#### UI tree

Installed modules can pass a tree:

```lua
{
    ClassName = "Frame",
    Properties = {
        Name = "Example",
        Size = UDim2.fromOffset(300, 120),
    },
    Children = {
        {
            ClassName = "TextLabel",
            Properties = { Text = "Hello" },
        },
    },
}
```

Accept `ClassName`/`className`/array index 1, `Properties`/`props`, and `Children`/`children`. Never accept a `Parent` property from serialized input. Apply properties with isolated `pcall` so one invalid property does not abort the whole tree.

Published UI bundle validation currently limits a root to 1,000 nodes and 32 levels and supports:

`ScreenGui`, `BillboardGui`, `SurfaceGui`, `Frame`, `ScrollingFrame`, `CanvasGroup`, `TextLabel`, `TextButton`, `TextBox`, `ImageLabel`, `ImageButton`, `VideoFrame`, `ViewportFrame`, `UIListLayout`, `UIGridLayout`, `UIPageLayout`, `UITableLayout`, `UIPadding`, `UIStroke`, `UICorner`, `UIGradient`, `UIAspectRatioConstraint`, `UISizeConstraint`, `UITextSizeConstraint`, `Folder`, `Configuration`, `StringValue`, `BoolValue`, `IntValue`, and `NumberValue`.

Serialized properties/attributes may be primitives or encoded `Color3`, `Vector2`, `Vector3`, `UDim`, `UDim2`, `Rect`, `ColorSequence`, `NumberSequence`, `EnumItem`, and `InstanceRef` values. The runtime must decode these safely and reject instance references outside the allowed module/UI namespace.

Source strings are not supported. Installed modules are `ModuleScript` instances, so the runtime must never execute UI source with `loadstring`.

### `_G.RoLinkModuleUI.Bind`

```lua
_G.RoLinkModuleUI.Bind(
    guiObject: GuiObject,
    handler: (player: Player, payload: table, instance: GuiObject) -> (),
    options: {
        Module: table?,
        Events: { string }?,
    }?
): ()
```

Binds a module-created control to trusted server-side handling. Default to a narrow allowed event list (for example `Activated`, `FocusLost`, or an explicitly declared subset). The client should send only a small normalized payload such as control name, event, text/value, and safe input state. The server must map the binding ID back to the server-owned instance and handler; never accept a client-provided instance path or callback.

Invoke the handler as `(sendingPlayer, normalizedPayload, boundInstance)` through `pcall`. Verify the player owns/can interact with that UI, rate-limit events, cap text and payload size, and remove bindings when the UI/module/player is destroyed.

## 15. Config schema and live action forms

A legacy module may declare a top-level `CONFIG` table. `CONFIG.Version` can supply the upload version. Other fields build the dashboard/panel form.

Common field properties:

- `Short_Description` or other display description;
- `Type`: examples include `Bool`, `Dropdown`, `String`, `CheckBoxes`, `Color Wheel`, `Integer`, `Player`, `Server`, and `Group`;
- `Default`;
- `Options`;
- `LIVE = true` for an immediate action rather than a saved setting;
- `ButtonText`, `LiveButtonText`, or `SendText` for action text; and
- `SubInputs`, `Inputs`, or `Fields` for a multi-input live action.

Player/server selectors may use:

- `Source = "roblox-users"` for Roblox-wide search;
- `Source = "live-players"` for current players across the game;
- `Source = "live-servers"` for current servers; or
- `Source = "live-server-players"` plus `Reference = "<server field key>"` for players in the selected server.

The panel must keep config schema and saved settings distinct. Saved fields update `Settings`; live fields create `MODULE_LIVE` commands and invoke a live handler without silently persisting the submitted value.

## 16. Error handling, security, and cleanup checklist

For every module-facing call:

- use `pcall` around `require`, lifecycle functions, hooks, commands, UI builders, UI events, and transport handlers;
- include module ID/name and operation in warnings;
- validate permissions on the server immediately before the action;
- validate module enabled/installed state;
- cap strings, tables, nesting, event frequency, and serialized payload size;
- never expose the Ro-Link/Discord API key, bot token, or internal credentials;
- do not trust client-provided `Player`, module ID, permission, target, report server, or job ID values;
- keep report, channel, and user-data calls scoped by the current server API key;
- avoid automatic retries for writes;
- disconnect events and destroy module-owned UI when a module unloads;
- remove all registrations on failed initialization or reload; and
- keep the core panel usable when a module fails.

Suggested return convention for panel-provided helpers:

```lua
return true, result
-- or
return false, "Human-readable error"
```

Programming errors (wrong execution context, missing required ModuleID, invalid `Player` type) may throw. Network and business-validation failures should normally return `false, message` so modules can handle them.

## 17. Current implementation differences

These are important when building the new panel because the repository's metadata, docs, installed runner, and v2 runner are not yet one identical implementation.

1. **Panel hooks are registered but not fired by the generated core.** `FireModuleHook` exists, but the generated bridge currently has no call site for `AdminPanelOpened` or `CommandBarOpened`. The in-game panel must call it after server authorization.
2. **Interactive module UI is documented but not installed by the generated core.** `_G.RoLinkModuleUI.Bind` appears in API metadata/docs, but the generated bridge source does not currently define the bridge. The new panel must implement it before advertising interactive module UI.
3. **`Notify` is currently only a print in the generated core.** It ignores the target and success/error styling. The new panel should connect it to the trusted feedback remote and preserve the documented signature.
4. **The installed context service list is narrower than metadata/docs.** The generated core currently includes `HttpService`, `Players`, and `MessagingService`; the v2 runner has the larger whitelist in this document. Provide an explicit, context-safe unified list.
5. **`CreateUI` builder shape differs from examples.** The generated installed runner passes an information table without `ui.Create`, while documentation examples call `ui.Create`. A new panel should add `ui.Create` and preserve the existing information fields.
6. **`ModuleId`, `CallClient`, and `CallServer` belong to the newer v2 runner.** The installed legacy admin runtime does not currently add them to `BuildModuleContext`. A panel hosting v2 projects must provide them.
7. **`GetConfig`, `GetSettings`, `RefreshConfig`, `RegisterCommandInPanel`, `RegisterCommandBar`, `RegisterCmdsBar`, and `context.RoLink` exist in the installed runtime but are missing from editor API metadata.** Treat the registration aliases as compatibility APIs. Treat `context.RoLink` as internal/legacy.
8. **`RegisterCommand` is currently panel-visible.** Some prose describes it as direct registration only, but the installed runner creates a default visible definition. Preserve current behavior until intentionally versioned.
9. **Module handler results are ignored.** The current runner logs thrown errors only. If the new panel displays returned success/error feedback, do so as a backward-compatible addition.
10. **`CreateReport` has a different wrapper shape.** It returns the complete `{ serverId, report }` payload, while other report helpers extract `report`/`reports`. Do not silently change existing modules without a compatibility layer.

## 18. Minimum end-to-end implementation order

For a new in-game panel, implement and test in this order:

1. safe discovery, metadata matching, load/reload/unload, and namespaced errors;
2. context fields, settings/config refresh, service whitelist, `Log`, player helpers;
3. `Commands`, `PanelCommands`, registration APIs, command normalization, and execution;
4. poll publication of `modulePanelCommands` and structured field submission;
5. server-authorized panel-open and command-bar-open hooks;
6. `Notify` and non-interactive `CreateUI`;
7. secure `_G.RoLinkModuleUI.Bind` interaction transport;
8. Discord, user-data, and report helpers;
9. live config/action forms and `MODULE_LIVE` routing; and
10. v2 `CallClient`/`CallServer`, `Start`, and `Destroy` support.

End-to-end tests should include two modules at once, duplicate command names, a module that throws in every callback type, reload after checksum change, removal cleanup, unauthorized hook/command attempts, malformed UI, oversized input, HTTP failure, command delivery to the correct live server, client transport spoof attempts, and rate-limit enforcement.

## 19. Complete example

```lua
CONFIG = {
    Version = "1.0.0",
    Notify_On_Open = {
        Short_Description = "Notify staff when they open the panel.",
        Type = "Bool",
        Default = true,
        Options = {},
    },
    Announcement = {
        Short_Description = "Send a message immediately.",
        Type = "String",
        Default = "",
        LIVE = true,
        ButtonText = "Send",
        Options = {},
    },
}

local Module = {}

function Module.Init(context, settings)
    context.Log("Loaded", context.Module.name, settings.Notify_On_Open)

    context.RegisterPanelCommand({
        Name = "module_note_report",
        Title = "Note Report",
        Description = "Add a moderator note to a report.",
        Category = "Reports",
        TargetRequired = false,
        SortOrder = 20,
        Fields = {
            { id = "reportId", label = "Report ID", required = true },
            { id = "note", label = "Note", required = true, multiline = true },
        },
    }, function(command, commandContext, args)
        local ok, reportOrError = commandContext.UpdateReport(args.reportId, {
            moderatorNote = args.note,
            moderatorId = command.args.moderator,
        })

        if not ok then
            commandContext.Log("Could not update report", reportOrError)
            return false, reportOrError
        end

        return true, reportOrError
    end)
end

function Module.OnAdminPanelOpened(player, payload, context)
    if context.Settings.Notify_On_Open then
        context.Notify(player, "Module tools are ready.", true)
    end
end

function Module.OnCommandBarOpened(player, payload, context)
    context.Log("Command bar opened by", player.Name, payload.source)
end

Module.Commands = {
    module_ping = function(command, context, args)
        context.Notify(context.FindPlayer(args.username), "Pong", true)
    end,
}

Module.LiveConfig = {
    Announcement = function(command, context, value)
        for _, player in ipairs(context.GetPlayers()) do
            context.Notify(player, tostring(value), true)
        end
    end,
}

-- These two handlers are used only when this package is hosted by the v2
-- server/client runtime. A real project normally places them in the relevant
-- separate entrypoints.
function Module.CallServer(context, player, action, payload)
    if action == "Ready" then
        context.Log(player.Name, "is ready")
    end
end

function Module.CallClient(context, action, payload)
    context.Log("Client action", action)
end

return Module
```

This API should be versioned when behavior changes. Compatibility aliases can remain, but new module examples should use the canonical names: `Init`, `Commands`, `PanelCommands` or `RegisterPanelCommand`, `OnAdminPanelOpened`, `OnCommandBarOpened`, `LiveConfig`, `CallClient`, and `CallServer`.
