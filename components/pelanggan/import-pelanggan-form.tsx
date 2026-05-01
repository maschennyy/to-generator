"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  X,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"

interface ParsedRow {
  row: number
  idPelanggan: string
  nama: string
  alamat: string
  tarif: string
  daya: number
  status: "valid" | "invalid"
  error?: string
}

export function ImportPelangganForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])

  const validCount = parsedData.filter((r) => r.status === "valid").length
  const invalidCount = parsedData.filter((r) => r.status === "invalid").length

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const validExtensions = [".xlsx", ".xls"]
    const fileName = selectedFile.name.toLowerCase()
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext))

    if (!isValid) {
      toast.error("Format file tidak valid", {
        description: "Hanya file .xlsx atau .xls",
      })
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar", { description: "Maksimal 10MB" })
      return
    }

    setFile(selectedFile)
    parseExcel(selectedFile)
  }

  async function parseExcel(file: File) {
    setIsParsing(true)
    setParsedData([])

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

      if (jsonData.length === 0) {
        toast.error("File kosong")
        setIsParsing(false)
        return
      }

      const parsed: ParsedRow[] = jsonData.map((row, index) => {
        const rowNum = index + 2

        const idPelanggan = cleanIdPelanggan(
          String(
            row["IDPEL"] ??
              row["idPelanggan"] ??
              row["ID Pelanggan"] ??
              row["ID_Pelanggan"] ??
              row["ID"] ??
              ""
          )
        )

        const nama = String(
          row["NAMA"] ??
            row["Nama"] ??
            row["nama"] ??
            row["NAMA PELANGGAN"] ??
            ""
        ).trim()

        const alamat = String(
          row["ALAMAT"] ??
            row["Alamat"] ??
            row["alamat"] ??
            row["LOKASI"] ??
            row["Lokasi"] ??
            row["ADDRESS"] ??
            ""
        ).trim()

        const tarif = String(
          row["TARIF"] ??
            row["Tarif"] ??
            row["tarif"] ??
            row["TRF"] ??
            "R1"
        ).trim()

        const dayaRaw =
          row["DAYA"] ?? row["Daya"] ?? row["daya"] ?? 900

        const daya = Number(dayaRaw) || 900

        let status: "valid" | "invalid" = "valid"
        let error: string | undefined

        if (!idPelanggan) {
          status = "invalid"
          error = "IDPEL kosong"
        } else if (!/^\d+$/.test(idPelanggan)) {
          status = "invalid"
          error = "IDPEL harus angka"
        } else if (!nama) {
          status = "invalid"
          error = "Nama kosong"
        } else if (!alamat) {
          status = "invalid"
          error = "Alamat kosong"
        }

        return {
          row: rowNum,
          idPelanggan,
          nama,
          alamat,
          tarif,
          daya,
          status,
          error,
        }
      })

      setParsedData(parsed)

      const valid = parsed.filter((r) => r.status === "valid").length
      const invalid = parsed.filter((r) => r.status === "invalid").length

      if (valid === 0) {
        toast.error("Tidak ada data valid", {
          description: `${invalid} baris error`,
        })
      } else {
        toast.success(`File berhasil di-parse`, {
          description: `${valid} valid, ${invalid} error`,
        })
      }
    } catch (error) {
      console.error(error)
      toast.error("Gagal membaca file Excel")
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImport() {
    const validData = parsedData.filter((r) => r.status === "valid")
    if (validData.length === 0) {
      toast.error("Tidak ada data valid untuk di-import")
      return
    }

    setIsImporting(true)

    try {
      const payload = {
        data: validData.map((row) => ({
          idPelanggan: row.idPelanggan,
          nama: row.nama,
          alamat: row.alamat,
          tarif: row.tarif,
          daya: row.daya,
        })),
      }

      const response = await fetch("/api/pelanggan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Gagal import")
      }

      toast.success("Import pelanggan berhasil!", {
        description: `${result.created} baru, ${result.updated} update${result.dataLengkapUpdated > 0 ? `, ${result.dataLengkapUpdated} jadi lengkap` : ""}`,
      })

      router.push("/pelanggan")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Gagal import data", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      })
      setIsImporting(false)
    }
  }

  function handleReset() {
    setFile(null)
    setParsedData([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function downloadTemplate() {
    const templateData = [
      {
        IDPEL: "5461009543",
        NAMA: "Contoh Nama Pelanggan",
        ALAMAT: "Jl. Contoh No. 123",
        TARIF: "R1",
        DAYA: 900,
      },
      {
        IDPEL: "5461009544",
        NAMA: "Contoh Pelanggan Lain",
        ALAMAT: "Jl. Example No. 456",
        TARIF: "B2",
        DAYA: 2200,
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Pelanggan")

    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 40 },
      { wch: 8 },
      { wch: 10 },
    ]

    XLSX.writeFile(workbook, "template-pelanggan.xlsx")
    toast.success("Template berhasil diunduh")
  }

  return (
    <div className="space-y-6">
      {/* Petunjuk */}
      <Card>
        <CardHeader>
          <CardTitle>Petunjuk Import Pelanggan</CardTitle>
          <CardDescription>
            Upload file Excel berisi data master pelanggan (dari DIL)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-md">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              Kolom yang Diperlukan:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 ml-4 list-disc">
              <li><strong>IDPEL</strong> — ID unik pelanggan (wajib, hanya angka)</li>
              <li><strong>NAMA</strong> — Nama pelanggan (wajib)</li>
              <li><strong>ALAMAT</strong> — Alamat pelanggan (wajib)</li>
              <li><strong>TARIF</strong> — Golongan tarif (R1, B2, dll)</li>
              <li><strong>DAYA</strong> — Daya dalam VA</li>
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-500 mt-2">
              💡 Kalau IDPEL sudah ada, data akan di-UPDATE (tidak duplikat)
            </p>
          </div>

          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template Excel
          </Button>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File Pelanggan</CardTitle>
          <CardDescription>
            Pilih file Excel (.xlsx atau .xls) maksimal 10MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Klik tombol di bawah untuk memilih file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="pelanggan-upload"
              />
              <label
                htmlFor="pelanggan-upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4" />
                Pilih File Excel
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isParsing || isImporting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parsing Loading */}
      {isParsing && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm text-muted-foreground">
              Memproses file Excel...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {!isParsing && parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle>Preview Data Pelanggan</CardTitle>
                <CardDescription>Review data sebelum import</CardDescription>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{validCount} Valid</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{invalidCount} Error</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md max-h-96 overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold">Row</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">IDPEL</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Nama</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Alamat</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Tarif</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold">Daya</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row) => (
                    <tr
                      key={row.row}
                      className={`border-b ${
                        row.status === "invalid"
                          ? "bg-red-50 dark:bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.row}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono">
                        {row.idPelanggan || "-"}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.nama || "-"}</td>
                      <td className="px-3 py-2 text-sm truncate max-w-xs">
                        {row.alamat || "-"}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.tarif}</td>
                      <td className="px-3 py-2 text-sm text-right">{row.daya}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.status === "valid" ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                            <XCircle className="h-3 w-3" />
                            {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isImporting}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengimport...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import {validCount} Data
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}