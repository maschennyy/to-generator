import { z } from "zod"

export const pemakaianSchema = z.object({
  pelangganId: z
    .string()
    .min(1, "Pelanggan wajib dipilih"),
  bulan: z
    .number({ message: "Bulan wajib diisi" })
    .int()
    .min(1, "Bulan minimal 1")
    .max(12, "Bulan maksimal 12"),
  tahun: z
    .number({ message: "Tahun wajib diisi" })
    .int()
    .min(2020, "Tahun minimal 2020")
    .max(2030, "Tahun maksimal 2030"),
  kwh: z
    .number({ message: "kWh wajib diisi" })
    .min(0, "kWh tidak boleh negatif"),
  keterangan: z.string().optional(),
})

export type PemakaianFormData = z.infer<typeof pemakaianSchema>

// Bulk input (array of pemakaian)
export const bulkPemakaianSchema = z.object({
  data: z.array(pemakaianSchema).min(1, "Minimal 1 data"),
})

// Utility: daftar nama bulan
export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

export const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
]

// Fungsi: dapatkan 12 bulan terakhir (rolling)
// Contoh: kalau sekarang April 2026, return dari Maret 2025 sampai Maret 2026
export function getRolling12Months(): { bulan: number; tahun: number }[] {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()

  // Mulai dari bulan kemarin (bulan ini - 1)
  const endMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const endYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const months: { bulan: number; tahun: number }[] = []

  // Loop mundur 12 bulan
  for (let i = 0; i < 12; i++) {
    let month = endMonth - i
    let year = endYear

    while (month <= 0) {
      month += 12
      year -= 1
    }

    months.unshift({ bulan: month, tahun: year })
  }

  return months
}

// Fungsi: format "Mar 2025"
export function formatBulanTahun(bulan: number, tahun: number): string {
  return `${NAMA_BULAN_PENDEK[bulan - 1]} ${tahun}`
}