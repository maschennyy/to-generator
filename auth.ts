import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { loginRatelimit } from "@/lib/ratelimit"  // ← tambahkan ini
import { headers } from "next/headers"             // ← tambahkan ini

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const headersList = await headers()
        const ip = headersList.get("x-forwarded-for") ?? "anonymous"
        const { success } = await loginRatelimit.limit(ip)
        if (!success) {
          throw new Error("Terlalu banyak percobaan login. Coba lagi dalam 15 menit.")
        }

        const username = credentials.username as string
        const password = credentials.password as string

        const user = await prisma.user.findUnique({
          where: { username },
        })

        if (!user || !user.aktif) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
          return null
        }

        // Log aktivitas login
        await prisma.logAktivitas.create({
          data: {
            userId: user.id,
            aksi: "LOGIN",
            detail: `User ${user.username} berhasil login`,
          },
        })

        return {
          id: user.id,
          username: user.username,
          nama: user.nama,
          role: user.role,
        }
      },
    }),
  ],
})