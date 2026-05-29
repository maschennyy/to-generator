import { config } from "dotenv"
config()

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Generate pemakaian bulanan dengan pola tertentu */
function generatePemakaian(
  pattern: "normal" | "turun_drastis" | "stagnan" | "nol" | "lonjakan" | "zigzag" | "bertahap_turun",
  months = 12
): { bulan: number; tahun: number; kwh: number }[] {
  const result: { bulan: number; tahun: number; kwh: number }[] = []
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()

  // Hitung titik awal (mundur `months` bulan dari sekarang)
  for (let i = months - 1; i >= 0; i--) {
    let month = currentMonth - i
    let year = currentYear
    while (month <= 0) {
      month += 12
      year -= 1
    }

    let kwh = 0

    switch (pattern) {
      case "normal":
        kwh = randomBetween(200, 450)
        break

      case "turun_drastis":
        // 9 bulan normal, 3 bulan terakhir drop > 50%
        if (i < 3) {
          kwh = randomBetween(30, 80)
        } else {
          kwh = randomBetween(280, 420)
        }
        break

      case "stagnan":
        // Nilai sama persis 3 bulan terakhir
        if (i < 3) {
          kwh = 175
        } else {
          kwh = randomBetween(150, 350)
        }
        break

      case "nol":
        // 2 bulan terakhir nol
        if (i < 2) {
          kwh = 0
        } else {
          kwh = randomBetween(120, 300)
        }
        break

      case "lonjakan":
        // Bulan terakhir melonjak > 300%
        if (i === 0) {
          kwh = randomBetween(900, 1400)
        } else {
          kwh = randomBetween(100, 200)
        }
        break

      case "zigzag":
        // Naik-turun ekstrem bergantian
        kwh = i % 2 === 0 ? randomBetween(400, 600) : randomBetween(50, 100)
        break

      case "bertahap_turun":
        // Turun konsisten setiap bulan selama 6 bulan terakhir
        if (i < 6) {
          const base = 350
          kwh = Math.max(10, base - (5 - i) * 55 + randomBetween(-10, 10))
        } else {
          kwh = randomBetween(300, 400)
        }
        break
    }

    result.push({ bulan: month, tahun: year, kwh })
  }

  return result
}

// ── Data Dummy ────────────────────────────────────────────────────────────────

const PELANGGAN_DUMMY = [
  // Normal
  { idPelanggan: "5660001000001", nama: "BUDI SANTOSO", tarif: "R1MT", daya: 900, lokasi: "KP BESAR RT 01", pattern: "normal" as const },
  { idPelanggan: "5660001000002", nama: "SRI WAHYUNI", tarif: "R1MT", daya: 1300, lokasi: "KP GELAM TENGAH", pattern: "normal" as const },
  { idPelanggan: "5660001000003", nama: "AHMAD FAUZI", tarif: "R1", daya: 900, lokasi: "KP RAWA KEPUH", pattern: "normal" as const },
  { idPelanggan: "5660001000004", nama: "DEWI RAHAYU", tarif: "B2", daya: 2200, lokasi: "JL MERDEKA NO 12", pattern: "normal" as const },
  { idPelanggan: "5660001000005", nama: "HENDRA WIJAYA", tarif: "R1MT", daya: 1300, lokasi: "KP TELUK NAGA", pattern: "normal" as const },

  // Anomali — Turun Drastis
  { idPelanggan: "5660001000011", nama: "ROHIDIN BIN RAMIN", tarif: "R1MT", daya: 900, lokasi: "KP TELUK NAGA", pattern: "turun_drastis" as const },
  { idPelanggan: "5660001000012", nama: "EKA SUHEKA", tarif: "R1MT", daya: 900, lokasi: "KP BESAR", pattern: "turun_drastis" as const },

  // Anomali — Stagnan
  { idPelanggan: "5660001000021", nama: "TARYA BIN SIAN", tarif: "R1T", daya: 900, lokasi: "KP RAWA KEPUH", pattern: "stagnan" as const },
  { idPelanggan: "5660001000022", nama: "SAIYAH", tarif: "R1MT", daya: 900, lokasi: "KP GURUDUG RT 1/3", pattern: "stagnan" as const },

  // Anomali — Nol Pemakaian
  { idPelanggan: "5660001000031", nama: "ERNI", tarif: "R1MT", daya: 900, lokasi: "KP RAWA ROTAN", pattern: "nol" as const },
  { idPelanggan: "5660001000032", nama: "RIYANTO", tarif: "R1MT", daya: 900, lokasi: "KP GELAM", pattern: "nol" as const },

  // Anomali — Lonjakan
  { idPelanggan: "5660001000041", nama: "BASYARUDIN", tarif: "R1T", daya: 900, lokasi: "KP GEMBONG", pattern: "lonjakan" as const },
  { idPelanggan: "5660001000042", nama: "SUPRIADI", tarif: "R1MT", daya: 1300, lokasi: "KP BAYUR LOR", pattern: "lonjakan" as const },

  // Anomali — Pola Tidak Wajar (Zigzag)
  { idPelanggan: "5660001000051", nama: "MUHIDIN", tarif: "R1MT", daya: 900, lokasi: "JL PEMUDA NO 5", pattern: "zigzag" as const },
  { idPelanggan: "5660001000052", nama: "SITI AMINAH", tarif: "R1", daya: 450, lokasi: "KP CIRUMPAK", pattern: "zigzag" as const },

  // Anomali — Pola Tidak Wajar (Penurunan Bertahap)
  { idPelanggan: "5660001000061", nama: "KASINO", tarif: "R1MT", daya: 900, lokasi: "KP TANJAKAN MEKAR", pattern: "bertahap_turun" as const },
  { idPelanggan: "5660001000062", nama: "WARTINI", tarif: "R1MT", daya: 1300, lokasi: "KP BENDA", pattern: "bertahap_turun" as const },

  // Data tidak lengkap (untuk test warning banner)
  { idPelanggan: "5660001000071", nama: "", tarif: "R1", daya: 900, lokasi: "", pattern: "normal" as const },
  { idPelanggan: "5660001000072", nama: "", tarif: "R1MT", daya: 900, lokasi: "", pattern: "normal" as const },
]

// IDPEL yang masuk TO Historis
const TO_HISTORIS_IDS = [
  "5660001000011",
  "5660001000021",
  "5660001000031",
  "5660001000041",
  "5660001000051",
  "5660001000061",
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Mulai seeding database...")
  console.log("")

  // ── 1. Users ────────────────────────────────────────────────────────────────
  const [adminPass, spvPass, userPass] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("spv123", 10),
    bcrypt.hash("user123", 10),
  ])

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password: adminPass, nama: "Administrator", role: "ADMIN" },
  })

  const spv = await prisma.user.upsert({
    where: { username: "spv" },
    update: {},
    create: { username: "spv", password: spvPass, nama: "Supervisor Teknik", role: "SPV" },
  })

  await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: { username: "user", password: userPass, nama: "Petugas Lapangan", role: "USER" },
  })

  console.log("✅ Users (3):")
  console.log("   admin  / admin123 — ADMIN")
  console.log("   spv    / spv123   — SPV")
  console.log("   user   / user123  — USER")
  console.log("")

  // ── 2. Pola Temuan ──────────────────────────────────────────────────────────
  const temuanList = [
    {
      namaPola: "Pemakaian Turun Drastis",
      deskripsi: "Pemakaian bulan ini < 50% rata-rata 6 bulan terakhir",
      kriteria: { tipe: "TURUN_DRASTIS", threshold: 0.5, periode: 6 },
    },
    {
      namaPola: "Pemakaian Stagnan",
      deskripsi: "Pemakaian sama persis 3 bulan berturut-turut",
      kriteria: { tipe: "STAGNAN", bulan: 3 },
    },
    {
      namaPola: "Nol Pemakaian",
      deskripsi: "Pemakaian 0 kWh selama 2 bulan berturut-turut",
      kriteria: { tipe: "NOL_PEMAKAIAN", bulan: 2 },
    },
    {
      namaPola: "Lonjakan Pemakaian",
      deskripsi: "Pemakaian naik > 300% secara mendadak",
      kriteria: { tipe: "LONJAKAN", threshold: 3.0 },
    },
    {
      namaPola: "Pola Tidak Wajar",
      deskripsi: "Zigzag ekstrem, meter statis, atau penurunan bertahap konsisten",
      kriteria: {
        tipe: "POLA_TIDAK_WAJAR",
        subTipe: ["ZIGZAG", "METER_STATIS", "BERTAHAP_TURUN"],
      },
    },
  ]

  for (const t of temuanList) {
    await prisma.temuan.upsert({ where: { namaPola: t.namaPola }, update: {}, create: t })
  }

  console.log(`✅ Pola temuan (${temuanList.length}): ${temuanList.map((t) => t.namaPola).join(", ")}`)
  console.log("")

  // ── 3. TO Historis ──────────────────────────────────────────────────────────
  for (const idPelanggan of TO_HISTORIS_IDS) {
    await prisma.tOHistoris.upsert({
      where: { idPelanggan },
      update: {},
      create: {
        idPelanggan,
        tanggalTemuan: new Date(Date.now() - randomBetween(30, 365) * 24 * 60 * 60 * 1000),
        kategori: "P2TL",
      },
    })
  }

  console.log(`✅ TO Historis (${TO_HISTORIS_IDS.length} IDPEL)`)
  console.log("")

  // ── 4. Pelanggan + Pemakaian ─────────────────────────────────────────────────
  const toHistorisSet = new Set(TO_HISTORIS_IDS)
  let pelangganCreated = 0
  let pemakaianCreated = 0
  const pelangganMap = new Map<string, string>() // idPelanggan -> db id

  for (const p of PELANGGAN_DUMMY) {
    const isToHistory = toHistorisSet.has(p.idPelanggan)
    const dataLengkap = !!(p.nama && p.lokasi)

    const pelanggan = await prisma.pelanggan.upsert({
      where: { idPelanggan: p.idPelanggan },
      update: {},
      create: {
        idPelanggan: p.idPelanggan,
        nama: p.nama,
        tarif: p.tarif,
        daya: p.daya,
        lokasi: p.lokasi,
        isToHistory,
        dataLengkap,
      },
    })

    pelangganMap.set(p.idPelanggan, pelanggan.id)
    pelangganCreated++

    // Buat pemakaian hanya jika belum ada
    const existingCount = await prisma.pemakaian.count({
      where: { pelangganId: pelanggan.id },
    })

    if (existingCount === 0 && p.nama) {
      const pemakaianData = generatePemakaian(p.pattern, 18)
      for (const pm of pemakaianData) {
        await prisma.pemakaian.upsert({
          where: {
            pelangganId_bulan_tahun: {
              pelangganId: pelanggan.id,
              bulan: pm.bulan,
              tahun: pm.tahun,
            },
          },
          update: {},
          create: {
            pelangganId: pelanggan.id,
            bulan: pm.bulan,
            tahun: pm.tahun,
            kwh: pm.kwh,
          },
        })
        pemakaianCreated++
      }
    }
  }

  console.log(`✅ Pelanggan: ${pelangganCreated} (termasuk 2 data tidak lengkap)`)
  console.log(`✅ Pemakaian: ${pemakaianCreated} baris (18 bulan per pelanggan)`)
  console.log("")

  // ── 5. Sample Target Operasi ─────────────────────────────────────────────────
  const toSamples: {
    idPelanggan: string
    tipeAnomali: "TURUN_DRASTIS" | "STAGNAN" | "NOL_PEMAKAIAN" | "LONJAKAN" | "POLA_TIDAK_WAJAR"
    alasan: string
    skor: number
    status: "PENDING" | "DIPROSES" | "SELESAI" | "DIBATALKAN"
    createdById: string
  }[] = [
    {
      idPelanggan: "5660001000011",
      tipeAnomali: "TURUN_DRASTIS",
      alasan: "Pemakaian turun drastis lebih dari 70% dibanding rata-rata 6 bulan sebelumnya.",
      skor: 0.87,
      status: "PENDING",
      createdById: spv.id,
    },
    {
      idPelanggan: "5660001000021",
      tipeAnomali: "STAGNAN",
      alasan: "Pemakaian persis sama 175 kWh selama 3 bulan berturut-turut.",
      skor: 0.85,
      status: "DIPROSES",
      createdById: spv.id,
    },
    {
      idPelanggan: "5660001000031",
      tipeAnomali: "NOL_PEMAKAIAN",
      alasan: "Pemakaian 0 kWh selama 2 bulan terakhir. Sambungan aktif namun tidak ada konsumsi.",
      skor: 1.0,
      status: "SELESAI",
      createdById: admin.id,
    },
    {
      idPelanggan: "5660001000041",
      tipeAnomali: "LONJAKAN",
      alasan: "Pemakaian melonjak lebih dari 500% dibanding bulan sebelumnya.",
      skor: 0.78,
      status: "PENDING",
      createdById: spv.id,
    },
    {
      idPelanggan: "5660001000051",
      tipeAnomali: "POLA_TIDAK_WAJAR",
      alasan: "Pola naik-turun ekstrem terdeteksi 4 kali balik arah dalam 8 bulan.",
      skor: 0.72,
      status: "PENDING",
      createdById: spv.id,
    },
    {
      idPelanggan: "5660001000061",
      tipeAnomali: "POLA_TIDAK_WAJAR",
      alasan: "Penurunan bertahap konsisten selama 6 bulan, total turun 48% dari baseline.",
      skor: 0.69,
      status: "DIBATALKAN",
      createdById: admin.id,
    },
  ]

  const now = new Date()
  const periodeStr = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`

  let toCreated = 0
  for (const t of toSamples) {
    const pelangganId = pelangganMap.get(t.idPelanggan)
    if (!pelangganId) continue

    const existing = await prisma.targetOperasi.findFirst({
      where: { pelangganId, periode: periodeStr },
    })

    if (!existing) {
      await prisma.targetOperasi.create({
        data: {
          pelangganId,
          tipeAnomali: t.tipeAnomali,
          alasan: t.alasan,
          skor: t.skor,
          status: t.status,
          periode: periodeStr,
          createdById: t.createdById,
        },
      })
      toCreated++
    }
  }

  console.log(`✅ Target Operasi: ${toCreated} sample (berbagai status)`)
  console.log("")

  // ── 6. Log Aktivitas sample ──────────────────────────────────────────────────
  const logCount = await prisma.logAktivitas.count()
  if (logCount === 0) {
    await prisma.logAktivitas.createMany({
      data: [
        { userId: admin.id, aksi: "LOGIN", detail: "Login pertama kali" },
        {
          userId: admin.id,
          aksi: "BULK_IMPORT_PELANGGAN",
          detail: `Background import: ${pelangganCreated} baru, 0 update, 0 error`,
        },
        {
          userId: spv.id,
          aksi: "GENERATE_TO",
          detail: `Background Generate TO: ${PELANGGAN_DUMMY.length} dianalisis, ${toSamples.length} anomali, ${toCreated} TO dibuat.`,
        },
      ],
    })
    console.log("✅ Log aktivitas: 3 sample")
  } else {
    console.log("ℹ️  Log aktivitas sudah ada, dilewati")
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("")
  console.log("🎉 Seeding selesai!")
  console.log("")
  console.log("📝 Login credentials:")
  console.log("   admin  / admin123  →  ADMIN (akses penuh)")
  console.log("   spv    / spv123    →  SPV   (generate & update TO)")
  console.log("   user   / user123   →  USER  (hanya lihat)")
  console.log("")
  console.log("📊 Data yang tersedia untuk testing:")
  console.log(`   - ${pelangganCreated} pelanggan (berbagai pola anomali)`)
  console.log(`   - ${pemakaianCreated} baris pemakaian (18 bulan/pelanggan)`)
  console.log(`   - ${TO_HISTORIS_IDS.length} IDPEL di TO Historis`)
  console.log(`   - ${toCreated} Target Operasi (PENDING, DIPROSES, SELESAI, DIBATALKAN)`)
  console.log("")
  console.log("💡 Pola anomali yang bisa ditest Generate TO:")
  console.log("   TURUN_DRASTIS    → 5660001000011, 5660001000012")
  console.log("   STAGNAN          → 5660001000021, 5660001000022")
  console.log("   NOL_PEMAKAIAN    → 5660001000031, 5660001000032")
  console.log("   LONJAKAN         → 5660001000041, 5660001000042")
  console.log("   POLA_TIDAK_WAJAR → 5660001000051, 5660001000052 (zigzag)")
  console.log("                      5660001000061, 5660001000062 (penurunan bertahap)")
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
