import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // akan di-set di auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = nextUrl.pathname === "/login"
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
      const isOnRoot = nextUrl.pathname === "/"

      // Login page
      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      // Root path - redirect based on login status
      if (isOnRoot) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return Response.redirect(new URL("/login", nextUrl))
      }

      // Protected routes (dashboard, etc.)
      if (isOnDashboard) {
        if (!isLoggedIn) {
          return Response.redirect(new URL("/login", nextUrl))
        }
        return true
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.nama = user.nama
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.nama = token.nama as string
        session.user.role = token.role as "ADMIN" | "SPV" | "USER"
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  trustHost: true,
} satisfies NextAuthConfig