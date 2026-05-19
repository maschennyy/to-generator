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

// Fungsi: dapatkan 12 bulan terakhir termasuk bulan SEKARANG
// Contoh: kalau sekarang Mei 2026, return dari Jun 2025 sampai Mei 2026
export function getRolling12Months(): { bulan: number; tahun: number }[] {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()
 
  const months: { bulan: number; tahun: number }[] = []
 
  // Loop mundur 12 bulan dari bulan INI (bukan bulan kemarin)
  for (let i = 11; i >= 0; i--) {
    let month = currentMonth - i
    let year = currentYear
 
    while (month <= 0) {
      month += 12
      year -= 1
    }
 
    months.push({ bulan: month, tahun: year })
  }
 
  return months
}
 
// Fungsi: generate daftar bulan antara dua titik (inklusif)
// Dipakai untuk filter rentang bulan di halaman pemakaian
export function generateMonthRange(
  dariBulan: number,
  dariTahun: number,
  sampaiBulan: number,
  sampaiTahun: number
): { bulan: number; tahun: number }[] {
  const months: { bulan: number; tahun: number }[] = []
  let month = dariBulan
  let year = dariTahun
 
  const maxIter = 120 // batas 10 tahun untuk keamanan
  let iter = 0
 
  while (
    (year < sampaiTahun || (year === sampaiTahun && month <= sampaiBulan)) &&
    iter < maxIter
  ) {
    months.push({ bulan: month, tahun: year })
    month++
    if (month > 12) {
      month = 1
      year++
    }
    iter++
  }
 
  return months
}

// Fungsi: format "Mar 2025"
export function formatBulanTahun(bulan: number, tahun: number): string {
  return `${NAMA_BULAN_PENDEK[bulan - 1]} ${tahun}`
}