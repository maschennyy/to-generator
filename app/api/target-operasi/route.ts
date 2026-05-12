import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { detectAnomaly, getPeriode } from "@/lib/anomali/detector"
import type { StatusTO, TipeAnomali } from "@/lib/generated/prisma/enums"

// GET /api/target-operasi
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = (searchParams.get("status") || "") as StatusTO | ""
    const tipe = (searchParams.get("tipe") || "") as TipeAnomali | ""
    const periode = searchParams.get("periode") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: {
      status?: StatusTO
      tipeAnomali?: TipeAnomali
      periode?: string
      pelanggan?: {
        OR?: Array<{ [key: string]: { contains: string; mode: "insensitive" } }>
      }
    } = {}

    if (status) where.status = status
    if (tipe) where.tipeAnomali = tipe
    if (periode) where.periode = periode
    if (search) {
      where.pelanggan = {
        OR: [
          { idPelanggan: { contains: search, mode: "insensitive" } },
          { nama: { contains: search, mode: "insensitive" } },
          { lokasi: { contains: search, mode: "insensitive" } },
        ],
      }
    }

    const [rows, total, statusCounts] = await Promise.all([
      prisma.targetOperasi.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ skor: "desc" }, { createdAt: "desc" }],
        include: {
          pelanggan: {
            select: {
              id: true,
              idPelanggan: true,
              nama: true,
              tarif: true,
              daya: true,
              lokasi: true,
              isToHistory: true,
            },
          },
          createdBy: { select: { id: true, nama: true, username: true } },
        },
      }),
      prisma.targetOperasi.count({ where }),
      prisma.targetOperasi.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ])

    const counts = {
      PENDING: 0,
      DIPROSES: 0,
      SELESAI: 0,
      DIBATALKAN: 0,
    } as Record<StatusTO, number>
    for (const c of statusCounts) {
      counts[c.status] = c._count._all
    }

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        counts,
      },
    })
  } catch (error) {
    console.error("GET /api/target-operasi error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// POST /api/target-operasi -> generate TO (run anomaly detection)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role === "USER") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin atau SPV" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const replaceExistingPending: boolean = body?.replaceExistingPending !== false

    // Load all pelanggan that have at least one pemakaian record.
    const pelangganList = await prisma.pelanggan.findMany({
      where: { pemakaian: { some: {} } },
      include: {
        pemakaian: {
          orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
        },
      },
    })

    let detected = 0
    let created = 0
    let skipped = 0
    const skippedReasons: Record<string, number> = {}

    for (const pelanggan of pelangganList) {
      const samples = pelanggan.pemakaian.map((p) => ({
        bulan: p.bulan,
        tahun: p.tahun,
        kwh: p.kwh,
      }))

      const hit = detectAnomaly(samples)
      if (!hit) {
        skipped++
        skippedReasons["tidak_ada_anomali"] =
          (skippedReasons["tidak_ada_anomali"] || 0) + 1
        continue
      }
      detected++

      const periode = getPeriode(samples)

      // Skip if an identical TO already exists for this pelanggan + periode.
      // Optionally replace PENDING ones so re-run picks up newer data.
      const existing = await prisma.targetOperasi.findFirst({
        where: {
          pelangganId: pelanggan.id,
          periode,
        },
      })

      if (existing) {
        if (replaceExistingPending && existing.status === "PENDING") {
          await prisma.targetOperasi.update({
            where: { id: existing.id },
            data: {
              tipeAnomali: hit.tipeAnomali,
              alasan: hit.alasan,
              skor: hit.skor,
            },
          })
          // Counted as created (refreshed)
          created++
        } else {
          skipped++
          skippedReasons["sudah_ada"] = (skippedReasons["sudah_ada"] || 0) + 1
        }
        continue
      }

      await prisma.targetOperasi.create({
        data: {
          pelangganId: pelanggan.id,
          tipeAnomali: hit.tipeAnomali,
          alasan: hit.alasan,
          skor: hit.skor,
          periode,
          status: "PENDING",
          createdById: session.user.id,
        },
      })
      created++
    }

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "GENERATE_TO",
        detail: `Generate TO: ${pelangganList.length} pelanggan dianalisis, ${detected} anomali terdeteksi, ${created} TO dibuat/diperbarui.`,
      },
    })

    return NextResponse.json({
      message: "Generate TO selesai",
      analyzed: pelangganList.length,
      detected,
      created,
      skipped,
      skippedReasons,
    })
  } catch (error) {
    console.error("POST /api/target-operasi error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// DELETE /api/target-operasi -> bulk delete by ids or deleteAll
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll) {
      const deleted = await prisma.targetOperasi.deleteMany({})
      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "DELETE_ALL_TO",
          detail: `Hapus SEMUA Target Operasi: ${deleted.count} data`,
        },
      })
      return NextResponse.json({
        message: "Semua Target Operasi dihapus",
        deleted: deleted.count,
      })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 TO untuk dihapus" },
        { status: 400 }
      )
    }

    const deleted = await prisma.targetOperasi.deleteMany({
      where: { id: { in: ids } },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "BULK_DELETE_TO",
        detail: `Hapus ${deleted.count} Target Operasi`,
      },
    })

    return NextResponse.json({
      message: `${deleted.count} Target Operasi dihapus`,
      deleted: deleted.count,
    })
  } catch (error) {
    console.error("DELETE /api/target-operasi error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
