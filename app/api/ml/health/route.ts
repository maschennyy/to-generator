import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { proxyMlRequest } from "../_utils"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return proxyMlRequest("/health")
}
