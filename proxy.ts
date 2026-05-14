import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    /*
     * Proteksi semua route KECUALI:
     * - /login (halaman publik)
     * - /api/auth/* (NextAuth internal)
     * - /_next/* (static files)
     * - /favicon.ico, gambar, dll
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
}