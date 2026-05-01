"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Save, Search } from "lucide-react"

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
import { NAMA_BULAN } from "@/lib/validations/pemakaian"

interface Pelanggan {
  id: string
  idPelanggan: string
  nama: string
  tarif: string
  daya: number
}

export function PemakaianForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([])
  const [isLoadingPelanggan, setIsLoadingPelanggan] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentDate = new Date()
  const defaultMonth =
    currentDate.getMonth() === 0 ? 12 : currentDate.getMonth()
  const defaultYear =
    currentDate.getMonth() === 0
      ? currentDate.getFullYear() - 1
      : currentDate.getFullYear()

  const [formData, setFormData] = useState({
    pelangganId: "",
    bulan: defaultMonth.toString(),
    tahun: defaultYear.toString(),
    kwh: "",
    keterangan: "",
  })

  // Fetch pelanggan saat mount
  useEffect(() => {
    async function fetchPelanggan() {
      try {
        const response = await fetch("/api/pelanggan-list")
        const result = await response.json()
        if (response.ok) {
          setPelangganList(result.data)
        }
      } catch (error) {
        console.error(error)
        toast.error("Gagal memuat daftar pelanggan")
      } finally {
        setIsLoadingPelanggan(false)
      }
    }
    fetchPelanggan()
  }, [])

  // Filter pelanggan berdasarkan search
  const filteredPelanggan = pelangganList.filter(
    (p) =>
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.idPelanggan.includes(searchQuery)
  )

  // Get pelanggan yang dipilih
  const selectedPelanggan = pelangganList.find(
    (p) => p.id === formData.pelangganId
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      const payload = {
        pelangganId: formData.pelangganId,
        bulan: parseInt(formData.bulan),
        tahun: parseInt(formData.tahun),
        kwh: parseFloat(formData.kwh),
        keterangan: formData.keterangan || undefined,
      }

      const response = await fetch("/api/pemakaian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.details) {
          const fieldErrors: Record<string, string> = {}
          Object.entries(result.details).forEach(([key, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[key] = messages[0]
            }
          })
          setErrors(fieldErrors)
        }
        toast.error("Gagal menyimpan data", {
          description: result.error || "Terjadi kesalahan",
        })
        setIsLoading(false)
        return
      }

      toast.success("Data pemakaian berhasil disimpan", {
        description: `${selectedPelanggan?.nama} - ${NAMA_BULAN[parseInt(formData.bulan) - 1]} ${formData.tahun}: ${formData.kwh} kWh`,
      })

      router.push("/pemakaian")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Terjadi kesalahan", {
        description: "Silakan coba lagi",
      })
      setIsLoading(false)
    }
  }

  // Generate daftar tahun (5 tahun terakhir + tahun depan)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Pemakaian Baru</CardTitle>
        <CardDescription>
          Isi detail pemakaian kWh untuk pelanggan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pilih Pelanggan */}
          <div className="space-y-2">
            <Label htmlFor="pelanggan">
              Pelanggan <span className="text-red-500">*</span>
            </Label>

            {/* Search pelanggan */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari pelanggan berdasarkan nama atau ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={isLoading || isLoadingPelanggan}
              />
            </div>

            {/* List pelanggan */}
            {isLoadingPelanggan ? (
              <div className="border rounded-md p-4 text-center">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Memuat daftar pelanggan...
                </p>
              </div>
            ) : pelangganList.length === 0 ? (
              <div className="border rounded-md p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum ada data pelanggan. Silakan tambah pelanggan terlebih
                  dahulu.
                </p>
              </div>
            ) : (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {filteredPelanggan.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    Tidak ada pelanggan yang cocok
                  </p>
                ) : (
                  filteredPelanggan.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, pelangganId: p.id })
                      }
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-b-0 transition-colors ${
                        formData.pelangganId === p.id
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : ""
                      }`}
                      disabled={isLoading}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{p.nama}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            ID: {p.idPelanggan}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {p.tarif}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {p.daya.toLocaleString("id-ID")} VA
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {errors.pelangganId && (
              <p className="text-sm text-red-500">{errors.pelangganId}</p>
            )}

            {selectedPelanggan && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 rounded-md">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  ✓ Dipilih: {selectedPelanggan.nama}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  ID: {selectedPelanggan.idPelanggan} |{" "}
                  {selectedPelanggan.tarif} |{" "}
                  {selectedPelanggan.daya.toLocaleString("id-ID")} VA
                </p>
              </div>
            )}
          </div>

          {/* Periode (Bulan & Tahun) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bulan">
                Bulan <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.bulan}
                onValueChange={(value) =>
                  setFormData({ ...formData, bulan: value ?? "" })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="bulan">
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {NAMA_BULAN.map((nama, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bulan && (
                <p className="text-sm text-red-500">{errors.bulan}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tahun">
                Tahun <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.tahun}
                onValueChange={(value) =>
                  setFormData({ ...formData, tahun: value ?? "" })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="tahun">
                  <SelectValue placeholder="Pilih tahun" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tahun && (
                <p className="text-sm text-red-500">{errors.tahun}</p>
              )}
            </div>
          </div>

          {/* kWh */}
          <div className="space-y-2">
            <Label htmlFor="kwh">
              Pemakaian (kWh) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kwh"
              type="number"
              step="0.01"
              min="0"
              placeholder="Contoh: 250.5"
              value={formData.kwh}
              onChange={(e) =>
                setFormData({ ...formData, kwh: e.target.value })
              }
              disabled={isLoading}
              required
            />
            {errors.kwh && (
              <p className="text-sm text-red-500">{errors.kwh}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Nilai pemakaian dalam kilowatt-hour (kWh)
            </p>
          </div>

          {/* Keterangan (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="keterangan">Keterangan (Opsional)</Label>
            <Input
              id="keterangan"
              type="text"
              placeholder="Contoh: Meter rusak, estimasi petugas, dll"
              value={formData.keterangan}
              onChange={(e) =>
                setFormData({ ...formData, keterangan: e.target.value })
              }
              disabled={isLoading}
            />
          </div>

          {/* Info box */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 rounded-md">
            <p className="text-sm text-amber-900 dark:text-amber-300">
              💡 <strong>Tip:</strong> Jika data pemakaian untuk periode yang
              sama sudah ada, data akan diperbarui (overwrite).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/pemakaian")}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.pelangganId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}