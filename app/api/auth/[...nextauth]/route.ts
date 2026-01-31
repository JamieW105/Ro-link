import NextAuth from "next-auth"
import DiscordProvider from "next-auth/providers/discord"

export const authOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: { params: { scope: 'identify guilds' } },
        }),
    ],
    callbacks: {
        async jwt({ token, account }: any) {
            if (account) {
                token.accessToken = account.access_token
            }
            return token
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken
            return session
        }
    },
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    // Add debugging in development
    debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

