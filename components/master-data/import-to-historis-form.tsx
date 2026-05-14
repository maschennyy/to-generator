"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  X,
  AlertTriangle,
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
  tanggalTemuan: string | null
  kategori: string | null
  status: "valid" | "invalid"
  error?: string
}

export function ImportToHistorisForm() {
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
      toast.error("Format file tidak valid")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar (max 10MB)")
      return
    }

    setFile(selectedFile)
    parseExcel(selectedFile)
  }

  function parseDate(dateValue: unknown): string | null {
    if (!dateValue) return null

    if (dateValue instanceof Date) {
      return dateValue.toISOString()
    }

    if (typeof dateValue === "number") {
      const excelEpoch = new Date(1900, 0, 1)
      const days = dateValue - 2
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
      return date.toISOString()
    }

    if (typeof dateValue === "string") {
      const parsed = new Date(dateValue)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    }

    return null
  }

  async function parseExcel(file: File) {
    setIsParsing(true)
    setParsedData([])

    try {
      const formData = new FormData()

      formData.append("file", file)

      const response = await fetch("/api/to-historis/parse", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Gagal parse file")
      }

      setParsedData(result.data)

      const valid = result.data.filter(
        (row: ParsedRow) => row.status === "valid"
      ).length

      const invalid = result.data.filter(
        (row: ParsedRow) => row.status === "invalid"
      ).length

      toast.success(
        `${valid} valid, ${invalid} error`
      )
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
      toast.error("Tidak ada data valid")
      return
    }

    setIsImporting(true)

    try {
      const payload = {
        data: validData.map((row) => ({
          idPelanggan: row.idPelanggan,
          tanggalTemuan: row.tanggalTemuan,
          kategori: row.kategori,
        })),
      }

      const response = await fetch("/api/to-historis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Gagal import")
      }

      toast.success("Import TO Historis berhasil!", {
        description: `${result.created} data, ${result.pelangganUpdated} pelanggan di-flag`,
      })

      router.push("/master-data/to-historis")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Gagal import", {
        description: error instanceof Error ? error.message : "Error",
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
    window.open("/templates/template-to-historis.xlsx", "_blank")

    toast.success("Template berhasil diunduh")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Petunjuk Import TO Historis</CardTitle>
          <CardDescription>
            Format file Excel untuk daftar pelanggan TO historis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 rounded-md">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">
              Kolom yang Diperlukan:
            </p>
            <ul className="text-sm text-amber-800 dark:text-amber-400 space-y-1 ml-4 list-disc">
              <li><strong>IDPEL</strong> — ID pelanggan (wajib, bisa dengan atau tanpa &apos;)</li>
              <li><strong>TANGGAL TEMUAN</strong> — Tanggal ditemukan (opsional)</li>
              <li><strong>KATEGORI</strong> — Kategori TO (opsional)</li>
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
              💡 Sistem akan otomatis hapus apostrof (&apos;) di depan IDPEL
            </p>
          </div>

          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload File TO Historis</CardTitle>
          <CardDescription>
            Pilih file Excel (.xlsx atau .xls) maksimal 10MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Klik untuk memilih file TO Historis
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="to-upload"
              />
              <label
                htmlFor="to-upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4" />
                Pilih File Excel
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-amber-600" />
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

      {isParsing && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600 mb-3" />
            <p className="text-sm text-muted-foreground">
              Memproses file Excel...
            </p>
          </CardContent>
        </Card>
      )}

      {!isParsing && parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle>Preview Data TO Historis</CardTitle>
                <CardDescription>Review data sebelum import</CardDescription>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {validCount} Valid
                  </span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {invalidCount} Error
                    </span>
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
                    <th className="px-3 py-2 text-left text-xs font-semibold">
                      Row
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">
                      IDPEL
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">
                      Tanggal
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">
                      Kategori
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">
                      Status
                    </th>
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
                      <td className="px-3 py-2 text-sm">
                        {row.tanggalTemuan
                          ? new Date(row.tanggalTemuan).toLocaleDateString(
                              "id-ID"
                            )
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {row.kategori || "-"}
                      </td>
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
                className="bg-amber-600 hover:bg-amber-700"
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