"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DAFTAR_TARIF, DAFTAR_DAYA } from "@/lib/validations/pelanggan"

interface PelangganFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    idPelanggan: string
    nama: string
    tarif: string
    daya: number
    lokasi: string
  }
}

export function PelangganForm({ mode, initialData }: PelangganFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    idPelanggan: initialData?.idPelanggan || "",
    nama: initialData?.nama || "",
    tarif: initialData?.tarif || "",
    daya: initialData?.daya?.toString() || "",
    lokasi: initialData?.lokasi || "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      const payload = {
        ...formData,
        daya: parseInt(formData.daya),
      }

      const url =
        mode === "create"
          ? "/api/pelanggan"
          : `/api/pelanggan/${initialData?.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle validation errors
        if (result.details) {
          const fieldErrors: Record<string, string> = {}
          Object.entries(result.details).forEach(([key, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[key] = messages[0]
            }
          })
          setErrors(fieldErrors)
          toast.error("Validasi gagal", {
            description: "Mohon periksa kembali form Anda",
          })
        } else {
          toast.error("Gagal menyimpan data", {
            description: result.error || "Terjadi kesalahan",
          })
        }
        setIsLoading(false)
        return
      }

      toast.success(
        mode === "create"
          ? "Pelanggan berhasil ditambahkan"
          : "Pelanggan berhasil diupdate",
        {
          description: `${formData.nama} (${formData.idPelanggan})`,
        }
      )

      router.push("/pelanggan")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Terjadi kesalahan", {
        description: "Silakan coba lagi",
      })
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Data Pelanggan Baru" : "Edit Data Pelanggan"}
        </CardTitle>
        <CardDescription>Isi semua field yang diperlukan</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ID Pelanggan */}
          <div className="space-y-2">
            <Label htmlFor="idPelanggan">
              ID Pelanggan <span className="text-red-500">*</span>
            </Label>
            <Input
              id="idPelanggan"
              type="text"
              placeholder="Contoh: 123456789012"
              value={formData.idPelanggan}
              onChange={(e) =>
                setFormData({ ...formData, idPelanggan: e.target.value })
              }
              disabled={isLoading}
              required
            />
            {errors.idPelanggan && (
              <p className="text-sm text-red-500">{errors.idPelanggan}</p>
            )}
            <p className="text-xs text-muted-foreground">
              ID unik pelanggan PLN (hanya angka)
            </p>
          </div>

          {/* Nama */}
          <div className="space-y-2">
            <Label htmlFor="nama">
              Nama Pelanggan <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nama"
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={formData.nama}
              onChange={(e) =>
                setFormData({ ...formData, nama: e.target.value })
              }
              disabled={isLoading}
              required
            />
            {errors.nama && (
              <p className="text-sm text-red-500">{errors.nama}</p>
            )}
          </div>

          {/* Grid untuk Tarif & Daya */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tarif */}
            <div className="space-y-2">
              <Label htmlFor="tarif">
                Golongan Tarif <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.tarif}
                onValueChange={(value) =>
                    setFormData({ ...formData, tarif: value ?? "" })
                }
                disabled={isLoading}
                >
                <SelectTrigger id="tarif">
                  <SelectValue placeholder="Pilih tarif" />
                </SelectTrigger>
                <SelectContent>
                  {DAFTAR_TARIF.map((tarif) => (
                    <SelectItem key={tarif} value={tarif}>
                      {tarif}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tarif && (
                <p className="text-sm text-red-500">{errors.tarif}</p>
              )}
              <p className="text-xs text-muted-foreground">
                R = Rumah, B = Bisnis, I = Industri, P = Pemerintah
              </p>
            </div>

            {/* Daya */}
            <div className="space-y-2">
              <Label htmlFor="daya">
                Daya (VA) <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.daya}
                onValueChange={(value) =>
                    setFormData({ ...formData, daya: value ?? "" })
                }
                disabled={isLoading}
                >
                <SelectTrigger id="daya">
                  <SelectValue placeholder="Pilih daya" />
                </SelectTrigger>
                <SelectContent>
                  {DAFTAR_DAYA.map((daya) => (
                    <SelectItem key={daya} value={daya.toString()}>
                      {daya.toLocaleString("id-ID")} VA
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.daya && (
                <p className="text-sm text-red-500">{errors.daya}</p>
              )}
            </div>
          </div>

          {/* Lokasi */}
          <div className="space-y-2">
            <Label htmlFor="lokasi">
              Lokasi / Alamat <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lokasi"
              type="text"
              placeholder="Contoh: Jl. Merdeka No. 123, Jakarta Pusat"
              value={formData.lokasi}
              onChange={(e) =>
                setFormData({ ...formData, lokasi: e.target.value })
              }
              disabled={isLoading}
              required
            />
            {errors.lokasi && (
              <p className="text-sm text-red-500">{errors.lokasi}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/pelanggan")}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {mode === "create" ? "Simpan" : "Update"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}