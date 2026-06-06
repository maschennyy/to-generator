import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { proxyMlRequest } from "../_utils"
import { parsePaginationParams } from "@/lib/api/request-helpers"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const { page, limit } = parsePaginationParams(searchParams, {
    defaultLimit: 5000,
    maxLimit: 10000,
  })

  return proxyMlRequest(`/scores?page=${page}&limit=${limit}`)
}
