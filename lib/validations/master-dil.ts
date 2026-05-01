import { z } from "zod"

export const masterDilSchema = z.object({
  idPelanggan: z
    .string()
    .min(1, "IDPEL wajib diisi")
    .regex(/^[0-9]+$/, "IDPEL hanya boleh angka"),
  nama: z.string().min(1, "Nama wajib diisi").max(200),
  alamat: z.string().min(1, "Alamat wajib diisi").max(500),
  tarif: z.string().min(1, "Tarif wajib diisi"),
  daya: z.number().int().positive(),
})

export type MasterDilFormData = z.infer<typeof masterDilSchema>

// Helper: bersihkan IDPEL (hapus apostrof & spasi)
export function cleanIdPelanggan(id: string | number): string {
  return String(id).replace(/['"]/g, "").trim()
}