# 🔗 Ro-Link

**The Ultimate Discord-to-Roblox Bridge**

Ro-Link is a powerful, open-source application that bridges the gap between your Discord community and your Roblox game. It allows Discord server administrators and moderators to manage their Roblox games directly from Discord using slash commands and an advanced web dashboard.

## ✨ Features

### 🛡️ Moderation
Execute moderation actions directly from Discord without joining the game:
- **/ban**: Permanently ban a user from your game.
- **/kick**: Kick a specific user from the server.
- **/unban**: Revoke a ban.
- **Logs**: All actions are logged to your Supabase database and Discord.

### 🎮 Server Management
Control your game servers remotely:
- **/shutdown**: Shut down specific servers (by Job ID) or global shutdowns.
- **/update**: Trigger a "soft shutdown" to force game updates.
- **Live Stats**: View active server counts and player lists (via Dashboard).

### 🪄 Fun & Utility (/misc)
Interact with players in real-time:
- **Fly / Noclip**: Give players flight or noclip permissions.
- **Invisible / Ghost**: Change player visibility and collision.
- **Heal / Kill**: Manage player health.
- **Set Character**: Morph players into other avatars.

### ⚡ Real-Time Architecture
- **Hybrid Bot System**: Works as a **Serverless Discord Bot** (Vercel) for high scalability and as a **Standalone Bot** for maintaining status and background tasks.
- **Open Cloud & Polling**: Uses Roblox Open Cloud for instant messaging and HTTP Polling for reliable command execution.

---

## 🏗️ Architecture

Ro-Link consists of three main components:

1.  **Web Dashboard (Next.js)**: 
    - A modern UI for linking Discord servers to Roblox games.
    - Generates specific API keys for security.
    - View logs and manage settings.
    - Hosted on Vercel.

2.  **Discord Bot**:
    - **Interaction Endpoint (`app/api/interactions`)**: Handles slash commands, buttons, and modals via Webhooks.
    - **Status Agent (`scripts/bot.js`)**: A lightweight process that updates the bot's "Playing" status and syncs global stats.

3.  **Roblox Game**:
    - Uses the RoLink installer plugin to place and configure the bridge in Studio.
    - Polls the Next.js API for commands.
    - Listens to Roblox MessagingService for instant updates.

---

## 🚀 Usage

### Verified Owners Only
Only the Discord Server Owner can run `/setup` to link a game.

1.  **Run `/setup`**: Enter your Roblox Place ID, Universe ID, and Open Cloud API Key.
2.  **Install the Plugin**: Open the [RoLink installer](https://create.roblox.com/store/asset/87859041511603/RoLink-installer) in Roblox Studio and paste in your generated Security Key.
3.  **Manage**: Use `/ban`, `/kick`, or `/misc` immediately.

---

## 📚 Documentation

For detailed installation and configuration instructions, please read the [**Setup Guide**](guide.md).

The setup guide also includes the marketplace **Module Developer API** for add-on authors, including `SendBotMessage`, lifecycle hooks, `CreateUI`, command registration, and player/helper functions.

### Dashboard UI

Dashboard features use [Dice UI](https://diceui.com/) with its neutral light/dark themes,
Lucide icons, and shared shadcn-compatible foundations in `components/ui`. See [AGENTS.md](./AGENTS.md) for the requirements
for future feature changes. Use the header switcher to choose light or dark mode;
the selection persists across dashboard and marketplace routes. Modules have
dedicated product pages at `/dashboard/marketplace/[moduleSlug]`.
The `@diceui` registry is configured in
`components.json`; copied Dice components retain their source URL and MIT notice.

Run the dashboard interaction checks on desktop and mobile with:

```bash
npx playwright install chromium
npm run test:dashboard-ui
```

To use an installed Chromium instead, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its
absolute path. Tests start a Next.js server on port 3100 and mock dashboard API
responses; they do not write to Discord, Roblox, or the database.


### Staff shifts

Apply `supabase/migrations/20261016000137_staff_shifts.sql` to the target Supabase
project before deploying this feature. It extends `dashboard_roles` and creates
private shift settings, wave history, shift history, and service-role-only RPCs.
The server must have `SUPABASE_SERVICE_ROLE_KEY`; browser credentials cannot access
shift data. Existing root-level schema scripts remain the baseline for a new database.

In **Settings → Roles**, grant **View Staff Shifts** and/or **Manage Staff Shift
Settings** independently. Open **Staff Shifts** from the dashboard sidebar,
and use its Shift settings button to enable shifts, choose automatic starts, and set the
wave length (default seven days) and per-person quota (default five hours).
Wave length and quota changes take effect in the next wave. Disabling shifts ends
active shifts and preserves history. A zero-hour quota means no quota.

A staff member must link their Roblox account and have a configured dashboard role
permission (or Discord administrator/server-management access). The authenticated
linked game's roster starts automatic shifts and confirms their time. Leaving the
game ends the shift; a missing heartbeat expires after two minutes and caps time at
the last confirmed heartbeat. Existing game polling is sufficient; no plugin update
is required. If automatic start is off, staff can start/end their own shifts from
the live panel while playing. Shift eligibility refreshes from Discord every minute.

Reports cover a rolling day, week, 30 days, six calendar months, the current
wave, or the previous completed wave. Previous-wave reports use that wave’s saved
dates and quota, excluding current-wave time. Apply
`supabase/migrations/20261023073855_staff_shift_previous_wave.sql` to enable this
report; no completed wave is shown as an empty state. Overlapping game sessions count time only once; sessions crossing a reporting
or wave boundary contribute only time within it. New waves start with zero hours
without deleting historical shifts. The live panel shows the signed-in staff
member's themed quota bar, lifetime confirmed hours, and total shift count.

Run `npm run test:staff-shifts` for isolated PostgreSQL tests using PGlite. They
exercise the actual migration, accounting, wave rollover, manual mode, pagination,
server/self scoping, and database permissions without changing a remote database.


### Discord shift commands

Apply `supabase/migrations/20261016002647_staff_shift_commands.sql` after the staff
shifts migration, and restart the standalone bot to register the updated slash
command definitions. Both the bot and signed interaction endpoint use the same
command handler. The standalone bot also needs `SUPABASE_SERVICE_ROLE_KEY` for the
private shift records.

- `/shift-manage start`: start a shift, or resume after a break, while in the linked
  game. This works with automatic shifts enabled or disabled.
- `/shift-manage break`: pause the current shift. Break time does not count toward
  quota; resuming keeps the same shift count.
- `/shift-manage stop`: end the current shift. Automatic heartbeats respect the
  stopped state until the user starts again or leaves and rejoins.
- `/shift`: privately view current shift time, status, wave quota progress, and
  lifetime totals.
- `/shift-leaderboard [period] [page]`: privately rank confirmed staff time for the
  selected period (default latest wave), ten staff per page. Requires **View Staff
  Shifts**; **Manage Staff Shift Settings** alone does not grant access.

Shift commands require a staff role and work only in Discord servers. Starting or
resuming also requires a linked Roblox account and a recent game roster. Replies
are private and cannot ping users or roles. The dashboard marks staff on break
without adding extra controls to its compact layout.


### Marketplace reviews

Before deploying product reviews, apply `supabase/migrations/20261025193540_module_reviews.sql` to the database that already has `supabase_schema_modules.sql`. Set `SUPABASE_SERVICE_ROLE_KEY` on the server alongside `NEXT_PUBLIC_SUPABASE_URL`; the service role key must never be exposed through a public environment variable. No remote database changes are performed by this PR.

Reviews are readable for published modules and for a creator’s own unpublished modules. Publishing or editing a review requires owning the module or managing a visible server with that module installed. Each Discord account has one editable rating/comment per module and can remove its own review after losing installer access. The API derives reviewer identity from the authenticated session; direct anonymous/authenticated database access to the review table and summary RPC is revoked.

Run `npm run test:module-reviews` for the actual migration, API authorization, rating/length constraints, averages, pagination, and grants against isolated PostgreSQL (PGlite).
