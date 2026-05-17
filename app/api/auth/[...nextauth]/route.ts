import NextAuth from "next-auth"
import type { AuthOptions, Session } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"
import { getSharedDashboardCookieDomain, isAllowedDashboardUrl } from "@/lib/customDashboardDomains"

type TokenShape = {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
    sub?: string
}

type DiscordAccount = {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    expires_in?: number
} | null

const cookieDomain = getSharedDashboardCookieDomain()
const secureCookies = process.env.NODE_ENV === "production"
    || Boolean(process.env.NEXTAUTH_URL?.startsWith("https://"))

async function refreshDiscordAccessToken(token: TokenShape) {
    if (!token.refreshToken) {
        return {
            ...token,
            accessToken: undefined,
            accessTokenExpires: 0,
            error: "RefreshAccessTokenError",
        }
    }

    try {
        const response = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID!,
                client_secret: process.env.DISCORD_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            }),
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            throw new Error(
                typeof refreshedTokens?.error_description === "string"
                    ? refreshedTokens.error_description
                    : typeof refreshedTokens?.error === "string"
                        ? refreshedTokens.error
                        : "Discord token refresh failed.",
            )
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + Number(refreshedTokens.expires_in || 0) * 1000,
            refreshToken: refreshedTokens.refresh_token || token.refreshToken,
            error: undefined,
        }
    } catch (error) {
        console.error("[AUTH] Failed to refresh Discord access token", {
            error: error instanceof Error ? error.message : error,
            userId: token.sub,
        })

        return {
            ...token,
            accessToken: undefined,
            accessTokenExpires: 0,
            error: "RefreshAccessTokenError",
        }
    }
}

export const authOptions: AuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: { params: { scope: 'identify guilds' } },
        }),
    ],
    pages: {
        signIn: "/auth/signin",
    },
    cookies: cookieDomain
        ? {
            sessionToken: {
                name: `${secureCookies ? "__Secure-" : ""}next-auth.session-token`,
                options: {
                    httpOnly: true,
                    sameSite: "lax",
                    path: "/",
                    secure: secureCookies,
                    domain: cookieDomain,
                },
            },
        }
        : undefined,
    callbacks: {
        async jwt({ token, account }: { token: TokenShape; account?: DiscordAccount }) {
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
                token.accessTokenExpires = account.expires_at
                    ? account.expires_at * 1000
                    : Date.now() + Number(account.expires_in || 0) * 1000
                token.error = undefined
                return token
            }

            if (typeof token.accessTokenExpires === "number" && Date.now() < token.accessTokenExpires - 60_000) {
                return token
            }

            return refreshDiscordAccessToken(token)
        },
        async session({ session, token }: { session: Session; token: TokenShape }) {
            session.accessToken = token.accessToken
            session.error = token.error
            if (session.user) {
                session.user.id = token.sub
            }
            return session
        },
        async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
            if (url.startsWith('/')) return `${baseUrl}${url}`
            if (url.startsWith(baseUrl)) return url
            if (isAllowedDashboardUrl(url)) return url
            return baseUrl
        }
    },
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    // Add debugging in development
    debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

