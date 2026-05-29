import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { StatusTO, TipeAnomali } from "@/lib/generated/prisma/enums";

const TIPE_LABEL: Record<string, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

const VALID_STATUS: StatusTO[] = ["PENDING", "DIPROSES", "SELESAI", "DIBATALKAN"];
const VALID_TIPE: TipeAnomali[] = [
  "TURUN_DRASTIS",
  "STAGNAN",
  "NOL_PEMAKAIAN",
  "LONJAKAN",
  "POLA_TIDAK_WAJAR",
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const filterStatus = searchParams.get("status") ?? "";
    const filterTipe = searchParams.get("tipe") ?? "";
    const filterPeriode = searchParams.get("periode") ?? "";

    const where: Prisma.TargetOperasiWhereInput = {};

    if (filterStatus && VALID_STATUS.includes(filterStatus as StatusTO)) {
      where.status = filterStatus as StatusTO;
    }
    if (filterTipe && VALID_TIPE.includes(filterTipe as TipeAnomali)) {
      where.tipeAnomali = filterTipe as TipeAnomali;
    }
    if (filterPeriode) where.periode = filterPeriode;

    if (search) {
      where.pelanggan = {
        OR: [
          { idPelanggan: { contains: search, mode: "insensitive" } },
          { nama: { contains: search, mode: "insensitive" } },
          { lokasi: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Biarkan TypeScript infer tipe allData (termasuk pelanggan dari include)
    const allData = await prisma.targetOperasi.findMany({
      where,
      orderBy: [{ skor: "desc" }, { createdAt: "desc" }],
      include: {
        pelanggan: {
          select: {
            idPelanggan: true,
            nama: true,
            tarif: true,
            daya: true,
            lokasi: true,
            isToHistory: true,
          },
        },
      },
    });

    if (allData.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data untuk diekspor" },
        { status: 404 }
      );
    }

    const now = new Date();
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Daftar TO ──────────────────────────────────────────────────
    const toHeader = [
      "No", "IDPEL", "Nama Pelanggan", "Tarif", "Daya (VA)", "Lokasi",
      "Tipe Anomali", "Alasan", "Skor (%)", "Status", "Periode",
      "TO Historis", "Tanggal Generate",
    ];
    const toRows = allData.map((item, i) => [
      i + 1,
      item.pelanggan.idPelanggan,          // ✅ sekarang dikenal
      item.pelanggan.nama || "",
      item.pelanggan.tarif,
      item.pelanggan.daya,
      item.pelanggan.lokasi,
      TIPE_LABEL[item.tipeAnomali] ?? item.tipeAnomali,
      item.alasan,
      Math.round(item.skor * 100),
      STATUS_LABEL[item.status] ?? item.status,
      item.periode,
      item.pelanggan.isToHistory ? "Ya" : "Tidak",
      item.createdAt.toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
      }),
    ]);

    const wsTO = XLSX.utils.aoa_to_sheet([toHeader, ...toRows]);
    wsTO["!cols"] = [
      { wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 8 }, { wch: 10 },
      { wch: 28 }, { wch: 20 }, { wch: 60 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTO, "Daftar TO");

    // ── Sheet 2: Rekap per Tipe ─────────────────────────────────────────────
    const rekapTipe = new Map<string, number>();
    for (const item of allData) {
      rekapTipe.set(item.tipeAnomali, (rekapTipe.get(item.tipeAnomali) ?? 0) + 1);
    }

    const tipeRows: (string | number)[][] = [
      ["Tipe Anomali", "Jumlah TO", "Persentase (%)"],
      ...Array.from(rekapTipe.entries()).map(([tipe, count]) => [
        TIPE_LABEL[tipe] ?? tipe,
        count,
        Math.round((count / allData.length) * 100),
      ]),
      ["TOTAL", allData.length, 100],
    ];
    const wsTipe = XLSX.utils.aoa_to_sheet(tipeRows);
    wsTipe["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsTipe, "Rekap Tipe");

    // ── Sheet 3: Rekap per Status ───────────────────────────────────────────
    const rekapStatus = new Map<string, number>();
    for (const item of allData) {
      rekapStatus.set(item.status, (rekapStatus.get(item.status) ?? 0) + 1);
    }

    const statusRows: (string | number)[][] = [
      ["Status", "Jumlah TO", "Persentase (%)"],
      ...Array.from(rekapStatus.entries()).map(([status, count]) => [
        STATUS_LABEL[status] ?? status,
        count,
        Math.round((count / allData.length) * 100),
      ]),
      ["TOTAL", allData.length, 100],
    ];
    const wsStatus = XLSX.utils.aoa_to_sheet(statusRows);
    wsStatus["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsStatus, "Rekap Status");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const parts = ["TO"];
    if (filterTipe) parts.push(TIPE_LABEL[filterTipe]?.replace(/\s/g, "-") ?? filterTipe);
    if (filterStatus) parts.push(STATUS_LABEL[filterStatus] ?? filterStatus);
    if (search) parts.push(`cari-${search.slice(0, 10)}`);
    const filename = `${parts.join("_")}_${now.toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/target-operasi/export error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengekspor data" },
      { status: 500 }
    );
  }
}
