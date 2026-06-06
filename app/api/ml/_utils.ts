import { NextResponse } from "next/server"

const DEFAULT_TIMEOUT_MS = 15_000

export function getMlServiceUrl() {
  const baseUrl = process.env.NALAR_SERVICE_URL?.trim() || process.env.ML_SERVICE_URL?.trim()
  if (!baseUrl) {
    return null
  }
  return baseUrl.replace(/\/$/, "")
}

function getMlServiceToken() {
  return process.env.NALAR_SERVICE_TOKEN?.trim() || process.env.ML_SERVICE_TOKEN?.trim() || null
}

export async function proxyMlRequest(path: string, init?: RequestInit) {
  const baseUrl = getMlServiceUrl()
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Skor NALAR tidak tersedia", detail: "NALAR_SERVICE_URL atau ML_SERVICE_URL belum diatur" },
      { status: 503 }
    )
  }

  const token = getMlServiceToken()
  if (!token) {
    return NextResponse.json(
      {
        error: "Skor NALAR tidak tersedia",
        detail: "NALAR_SERVICE_TOKEN atau ML_SERVICE_TOKEN belum diatur di aplikasi Next.js.",
      },
      { status: 503 }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        "X-ML-Service-Token": token,
      },
      cache: "no-store",
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Skor NALAR tidak tersedia",
          detail: data.detail || data.error || `NALAR service error ${response.status}`,
        },
        { status: response.status === 404 ? 404 : 503 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "AbortError"
        ? "NALAR service tidak merespons dalam batas waktu. Pastikan FastAPI berjalan dan tidak sedang overload."
        : "NALAR service tidak dapat dihubungi. Pastikan FastAPI berjalan, NALAR_SERVICE_URL/ML_SERVICE_URL benar, dan service berada di jaringan yang sama."

    return NextResponse.json(
      {
        error: "Skor NALAR tidak tersedia",
        detail,
      },
      { status: 503 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
