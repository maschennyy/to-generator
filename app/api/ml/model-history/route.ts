import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { proxyMlRequest } from "../_utils"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Hanya Admin" }, { status: 403 })
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "50")
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50

  return proxyMlRequest(`/model-history?limit=${limit}`)
}
