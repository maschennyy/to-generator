import { z } from "zod"

export const toHistorisSchema = z.object({
  idPelanggan: z
    .string()
    .min(1, "IDPEL wajib diisi"),
  tanggalTemuan: z.date().optional(),
  kategori: z.string().optional(),
})

export type ToHistorisFormData = z.infer<typeof toHistorisSchema>

// Daftar kategori TO umum
export const DAFTAR_KATEGORI_TO = [
  "Pencurian Listrik",
  "Meter Rusak",
  "Pemakaian Tidak Wajar",
  "P2TL",
  "Lainnya",
] as const