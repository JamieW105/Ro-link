# Ro-Link

Ro-Link is a bridge application connecting Discord communities to their Roblox games. It allows Discord server administrators to manage their Roblox games directly from Discord slash commands.

## Architecture
- **Web Dashboard (Next.js)**: For linking Discord servers to Roblox games and generating API keys.
- **Discord Bot**: Interface for moderation commands.
- **Roblox Script**: A Lua script that polls the backend for commands to execute in-game.
- **Backend**: API and Database (Supabase + Next.js) to manage the command queue.

## planned Commands
The system will support the following Discord slash commands:

- `/ban [user]` - Permanently ban a user from the game.
- `/softban [user]` - (To be defined: e.g., Ban then unban to clear data, or server-specific ban?)
- `/kick [user]` - Kick a user from the current server.
- `/timed_kick [user] [duration]` - (To be defined: Delayed kick or Temporary Ban?)
