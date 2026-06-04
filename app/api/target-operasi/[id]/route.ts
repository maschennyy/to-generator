import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { StatusTO } from "@prisma/client"

type HasilOperasiStatus = "BELUM_DIPERIKSA" | "NORMAL" | "PELANGGARAN" | "TIDAK_DITEMUKAN"

const VALID_STATUS: StatusTO[] = [
  "PENDING",
  "DIPROSES",
  "SELESAI",
  "DIBATALKAN",
]
const VALID_HASIL_OPERASI: HasilOperasiStatus[] = [
  "BELUM_DIPERIKSA",
  "NORMAL",
  "PELANGGARAN",
  "TIDAK_DITEMUKAN",
]

// PATCH /api/target-operasi/[id]
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    const body = await request.json()
    const { status, catatan, hasilOperasi } = body as {
      status?: StatusTO
      catatan?: string | null
      hasilOperasi?: {
        hasil?: HasilOperasiStatus
        tanggalOperasi?: string | null
        kategoriTemuan?: string | null
        catatan?: string | null
      }
    }

    const update: { status?: StatusTO; catatan?: string | null } = {}
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json(
          { error: "Status tidak valid" },
          { status: 400 }
        )
      }
      update.status = status
    }
    if (catatan !== undefined) update.catatan = catatan

    if (hasilOperasi) {
      if (!hasilOperasi.hasil || !VALID_HASIL_OPERASI.includes(hasilOperasi.hasil)) {
        return NextResponse.json(
          { error: "Hasil operasi tidak valid" },
          { status: 400 }
        )
      }
      const [hasilTable] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regclass('public.hasil_operasi') IS NOT NULL AS "exists"
      `
      if (!hasilTable?.exists) {
        return NextResponse.json(
          { error: "Tabel hasil_operasi belum ada. Jalankan migration Prisma terlebih dahulu." },
          { status: 503 }
        )
      }
    }

    if (Object.keys(update).length === 0) {
      if (!hasilOperasi) {
        return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 })
      }
    }

    const existing = await prisma.targetOperasi.findUnique({
      where: { id },
      include: { pelanggan: { select: { id: true, idPelanggan: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "TO tidak ditemukan" }, { status: 404 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const target = await tx.targetOperasi.update({
        where: { id },
        data: update,
      })

      if (hasilOperasi) {
        const tanggalOperasi = hasilOperasi.tanggalOperasi
          ? new Date(hasilOperasi.tanggalOperasi)
          : new Date()
        const kategoriTemuan = hasilOperasi.kategoriTemuan?.trim() || null
        const catatanHasil = hasilOperasi.catatan?.trim() || catatan || null
        const hasilOperasiId = randomUUID()

        await tx.$executeRaw`
          INSERT INTO "hasil_operasi" (
            "id",
            "targetOperasiId",
            "pelangganId",
            "hasil",
            "tanggalOperasi",
            "kategoriTemuan",
            "catatan",
            "petugasId",
            "updatedAt"
          )
          VALUES (
            ${hasilOperasiId},
            ${id},
            ${existing.pelanggan.id},
            ${hasilOperasi.hasil}::"HasilOperasiStatus",
            ${tanggalOperasi},
            ${kategoriTemuan},
            ${catatanHasil},
            ${session.user.id},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT ("targetOperasiId") DO UPDATE SET
            "hasil" = EXCLUDED."hasil",
            "tanggalOperasi" = EXCLUDED."tanggalOperasi",
            "kategoriTemuan" = EXCLUDED."kategoriTemuan",
            "catatan" = EXCLUDED."catatan",
            "petugasId" = EXCLUDED."petugasId",
            "updatedAt" = CURRENT_TIMESTAMP
        `

        if (hasilOperasi.hasil === "PELANGGARAN") {
          await tx.tOHistoris.upsert({
            where: { idPelanggan: existing.pelanggan.idPelanggan },
            create: {
              idPelanggan: existing.pelanggan.idPelanggan,
              tanggalTemuan: hasilOperasi.tanggalOperasi
                ? new Date(hasilOperasi.tanggalOperasi)
                : new Date(),
              kategori: hasilOperasi.kategoriTemuan?.trim() || "Hasil Operasi",
            },
            update: {
              tanggalTemuan: hasilOperasi.tanggalOperasi
                ? new Date(hasilOperasi.tanggalOperasi)
                : undefined,
              kategori: hasilOperasi.kategoriTemuan?.trim() || undefined,
            },
          })
          await tx.pelanggan.update({
            where: { id: existing.pelanggan.id },
            data: { isToHistory: true },
          })
        }

        return tx.targetOperasi.findUnique({
          where: { id },
        })
      }

      return target
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "UPDATE_TO",
        detail: `Update TO ${existing.pelanggan.idPelanggan}: ${
          update.status ? `status -> ${update.status}` : ""
        }${hasilOperasi?.hasil ? ` hasil -> ${hasilOperasi.hasil}` : ""}${update.catatan !== undefined ? " (catatan diperbarui)" : ""}`.trim(),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/target-operasi/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// DELETE /api/target-operasi/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    await prisma.targetOperasi.delete({ where: { id } })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "DELETE_TO",
        detail: `Hapus TO ${id}`,
      },
    })

    return NextResponse.json({ message: "TO dihapus" })
  } catch (error) {
    console.error("DELETE /api/target-operasi/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
