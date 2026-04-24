import { config } from "dotenv"
config()

import { PrismaClient } from "../lib/generated/prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Mulai seeding database...")

  // Hash passwords
  const adminPassword = await bcrypt.hash("admin123", 10)
  const userPassword = await bcrypt.hash("user123", 10)
  const spvPassword = await bcrypt.hash("spv123", 10)

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPassword,
      nama: "Administrator",
      role: "ADMIN",
    },
  })

  // Create regular user
  const user = await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: {
      username: "user",
      password: userPassword,
      nama: "User Testing",
      role: "USER",
    },
  })

  // Create supervisor
  const spv = await prisma.user.upsert({
    where: { username: "spv" },
    update: {},
    create: {
      username: "spv",
      password: spvPassword,
      nama: "Supervisor",
      role: "SPV",
    },
  })

  console.log("✅ Users created:")
  console.log("   -", admin.username, "(" + admin.role + ")")
  console.log("   -", user.username, "(" + user.role + ")")
  console.log("   -", spv.username, "(" + spv.role + ")")

  // Create pola temuan referensi
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
  ]

  for (const temuan of temuanList) {
    await prisma.temuan.upsert({
      where: { namaPola: temuan.namaPola },
      update: {},
      create: temuan,
    })
  }

  console.log("✅ Pola temuan created:", temuanList.length, "pola")

  console.log("\n🎉 Seeding selesai!")
  console.log("\n📝 Login credentials untuk testing:")
  console.log("   Admin → username: admin, password: admin123")
  console.log("   SPV   → username: spv,   password: spv123")
  console.log("   User  → username: user,  password: user123")
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })