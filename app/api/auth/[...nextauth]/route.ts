import NextAuth from "next-auth"
import type { AuthOptions, Session } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"
import { getSharedDashboardCookieDomain, isAllowedDashboardUrl } from "@/lib/customDashboardDomains"
import { DGSU_BAN_AUTH_ERROR } from "@/lib/dgsuBanConstants"
import { findDgsuBanForDiscordLogin, findDgsuBanForUser } from "@/lib/dgsuBans"
import { getDiscordOAuthConfig } from "@/lib/discordOAuthConfig"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type TokenShape = {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
    errorCode?: string
    errorDescription?: string
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
const discordOAuthConfig = getDiscordOAuthConfig()

async function refreshDiscordAccessToken(token: TokenShape) {
    if (!token.refreshToken) {
        return {
            ...token,
            accessToken: undefined,
            refreshToken: undefined,
            accessTokenExpires: 0,
            error: "RefreshAccessTokenError",
            errorCode: "missing_refresh_token",
        }
    }

    try {
        const response = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: discordOAuthConfig.clientId,
                client_secret: discordOAuthConfig.clientSecret,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            }),
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            const discordError = typeof refreshedTokens?.error === "string"
                ? refreshedTokens.error
                : "discord_token_refresh_failed"
            const description = typeof refreshedTokens?.error_description === "string"
                ? refreshedTokens.error_description
                : "Discord token refresh failed."

            console.warn("[AUTH] Discord access token refresh rejected", {
                error: discordError,
                userId: token.sub,
            })

            return {
                ...token,
                accessToken: undefined,
                refreshToken: discordError === "invalid_grant" ? undefined : token.refreshToken,
                accessTokenExpires: 0,
                error: "RefreshAccessTokenError",
                errorCode: discordError,
                errorDescription: description,
            }
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + Number(refreshedTokens.expires_in || 0) * 1000,
            refreshToken: refreshedTokens.refresh_token || token.refreshToken,
            error: undefined,
            errorCode: undefined,
            errorDescription: undefined,
        }
    } catch (error) {
        console.error("[AUTH] Failed to refresh Discord access token", {
            error: error instanceof Error ? error.message : error,
            userId: token.sub,
        })

        return {
            ...token,
            accessToken: undefined,
            refreshToken: undefined,
            accessTokenExpires: 0,
            error: "RefreshAccessTokenError",
            errorCode: "refresh_request_failed",
        }
    }
}

export const authOptions: AuthOptions = {
    providers: [
        DiscordProvider({
            clientId: discordOAuthConfig.clientId,
            clientSecret: discordOAuthConfig.clientSecret,
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
        async signIn({ user, account }) {
            const discordUserId = String(user?.id || account?.providerAccountId || "").trim()
            const discordAccessToken = typeof account?.access_token === "string"
                ? account.access_token
                : undefined

            if (!discordUserId) {
                return true
            }

            try {
                const ban = await findDgsuBanForDiscordLogin(getSupabaseAdmin(), {
                    discordUserId,
                    discordAccessToken,
                })

                if (ban) {
                    console.warn("[AUTH] DGSU banned account attempted sign in", {
                        discordUserId,
                        banTargetType: ban.target_type,
                        banTargetId: ban.target_id,
                    })
                    return `/auth/signin?error=${encodeURIComponent(DGSU_BAN_AUTH_ERROR)}`
                }
            } catch (error) {
                console.error("[AUTH] DGSU login check failed", {
                    discordUserId,
                    error: error instanceof Error ? error.message : error,
                })
            }

            return true
        },
        async jwt({ token, account }: { token: TokenShape; account?: DiscordAccount }) {
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
                token.accessTokenExpires = account.expires_at
                    ? account.expires_at * 1000
                    : Date.now() + Number(account.expires_in || 0) * 1000
                token.error = undefined
                token.errorCode = undefined
                return token
            }

            if (token.error === "RefreshAccessTokenError") {
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

            if (token.sub) {
                try {
                    const ban = await findDgsuBanForUser(getSupabaseAdmin(), {
                        discordUserId: token.sub,
                    })

                    if (ban) {
                        console.warn("[AUTH] Existing session belongs to DGSU banned account", {
                            discordUserId: token.sub,
                            banTargetType: ban.target_type,
                            banTargetId: ban.target_id,
                        })
                        session.accessToken = undefined
                        session.error = DGSU_BAN_AUTH_ERROR
                    }
                } catch (error) {
                    console.error("[AUTH] DGSU session check failed", {
                        discordUserId: token.sub,
                        error: error instanceof Error ? error.message : error,
                    })
                }
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

