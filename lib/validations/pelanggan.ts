import { z } from "zod"

export const pelangganSchema = z.object({
  idPelanggan: z
    .string()
    .min(1, "ID Pelanggan wajib diisi")
    .max(20, "ID Pelanggan maksimal 20 karakter")
    .regex(/^[0-9]+$/, "ID Pelanggan hanya boleh angka"),
  nama: z
    .string()
    .min(3, "Nama minimal 3 karakter")
    .max(200, "Nama maksimal 200 karakter"),
  tarif: z
    .string()
    .min(1, "Tarif wajib dipilih"),
  daya: z
    .number({ message: "Daya wajib diisi" })
    .int("Daya harus berupa angka bulat")
    .positive("Daya harus lebih dari 0"),
  lokasi: z
    .string()
    .min(3, "Lokasi minimal 3 karakter")
    .max(500, "Lokasi maksimal 500 karakter"),
  isToHistory: z.boolean().optional().default(false),
  dataLengkap: z.boolean().optional().default(true),
})

export type PelangganFormData = z.infer<typeof pelangganSchema>

// Daftar tarif PLN (urut abjad)
export const DAFTAR_TARIF = [
  "B1",
  "B1T",
  "B2",
  "B2T",
  "B3",
  "C",
  "I1",
  "I1T",
  "I2",
  "I3",
  "I3P",
  "L",
  "LT",
  "P1",
  "P1T",
  "P2",
  "P3",
  "P3T",
  "R1",
  "R1M",
  "R1T",
  "R2",
  "R2T",
  "R3",
  "R3T",
  "S1",
  "S1T",
  "S2",
  "S2K",
  "T",
] as const

// Daftar daya (urut ascending)
export const DAFTAR_DAYA = [
  450, 900, 1300, 2200, 3500, 4400, 5500, 6600, 7700, 10600,
  11000, 13200, 16500, 23000, 33000, 41500, 53000, 60000, 65000, 66000,
  82500, 105000, 131000, 147000, 164000, 197000, 210000, 233000, 240000, 245000,
  250000, 270000, 275000, 279000, 300000, 310000, 315000, 329000, 340000, 345000,
  360000, 380000, 400000, 414000, 415000, 449000, 450000, 455000, 485000, 500000,
  520000, 525000, 526000, 529000, 555000, 590000, 600000, 605000, 625000, 630000,
  650000, 670000, 680000, 690000, 725000, 730000, 750000, 780000, 800000, 825000,
  830000, 850000, 865000, 900000, 930000, 935000, 950000, 970000, 980000, 1000000,
  1040000, 1050000, 1060000, 1080000, 1100000, 1110000, 1145000, 1200000, 1210000, 1245000,
  1250000, 1260000, 1286500, 1300000, 1320000, 1385000, 1460000, 1500000, 1525000, 1560000,
  1570000, 1600000, 1660000, 1730000, 1800000, 1815000, 1845000, 1850000, 1900000, 1905000,
  2000000, 2075000, 2180000, 2285000, 2500000, 2557000, 2725000, 2770000, 2894000, 2960000,
  3000000, 3115000, 3465000, 3500000, 3805000, 3870000, 4150000, 4330000, 4700000, 5000000,
  5540000, 5710000, 6055000, 8660000, 10000000, 15000000, 17000000, 65000000,
] as const