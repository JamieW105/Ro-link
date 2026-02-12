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
    - Contains a `ModuleScript` (RoLink) and a Server Script.
    - Polls the Next.js API for commands.
    - Listens to Roblox MessagingService for instant updates.

---

## 🚀 Usage

### Verified Owners Only
Only the Discord Server Owner can run `/setup` to link a game.

1.  **Run `/setup`**: Enter your Roblox Place ID, Universe ID, and Open Cloud API Key.
2.  **Install Lua Script**: The bot will generate a secure script. Paste this into your Roblox game (ServerScriptService).
3.  **Manage**: Use `/ban`, `/kick`, or `/misc` immediately.

---

## 📚 Documentation

For detailed installation and configuration instructions, please read the [**Setup Guide**](guide.md).
