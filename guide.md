# Ro-Link

Ro-Link comes with:
- **Next.js Web Dashboard** (Hosted on Vercel)
- **Discord Bot** (Hosted on Vercel via Interactions, or Standalone for Status)
- **Roblox Link** (Lua Scripts)

## 🚧 Setup Instructions

1. **Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_PUBLIC_KEY`
   - `NEXT_PUBLIC_BASE_URL`

2. **Run Locally**:
   ```bash
   npm run dev
   ```

3. **Discord Bot Status Note**:
   Since Vercel is serverless, the bot cannot hold a "Status" (Presence) while hosted there.
   To have the "Watching X servers" status, you must run the standalone bot script on a VPS or your PC:
   ```bash
   npm run bot
   ```
