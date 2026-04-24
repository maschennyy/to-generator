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
    .max(100, "Nama maksimal 100 karakter"),
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
    .max(200, "Lokasi maksimal 200 karakter"),
})

export type PelangganFormData = z.infer<typeof pelangganSchema>

// Daftar tarif PLN
export const DAFTAR_TARIF = [
  "R1", "R2", "R3",      // Rumah Tangga
  "B1", "B2", "B3",      // Bisnis
  "I1", "I2", "I3", "I4", // Industri
  "P1", "P2", "P3",      // Pemerintah
  "S1", "S2", "S3",      // Sosial
  "L",                   // Lainnya
] as const

// Daftar daya yang umum
export const DAFTAR_DAYA = [
  450, 900, 1300, 2200, 3500, 
  4400, 5500, 7700, 11000, 13200,
  16500, 23000, 33000, 41500, 53000,
] as const