import type { NextAuthConfig } from "next-auth"

// Semua route yang memerlukan login (selain /login itu sendiri)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pelanggan",
  "/pemakaian",
  "/target-operasi",
  "/laporan",
  "/master-data",
  "/admin",
]

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // di-set di auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      // Halaman login
      if (pathname === "/login") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      // Root path
      if (pathname === "/") {
        return Response.redirect(
          new URL(isLoggedIn ? "/dashboard" : "/login", nextUrl)
        )
      }

      // Cek apakah route perlu login
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
      )

      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl))
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
    maxAge: 24 * 60 * 60, // 24 jam
  },
  trustHost: true,
} satisfies NextAuthConfig
