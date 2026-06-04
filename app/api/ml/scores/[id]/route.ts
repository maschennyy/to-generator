import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { proxyMlRequest } from "../../_utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  return proxyMlRequest(`/scores/${encodeURIComponent(id)}`)
}
