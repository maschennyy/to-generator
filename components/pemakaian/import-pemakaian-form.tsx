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
  AlertTriangle,
  Loader2,
  Download,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NAMA_BULAN } from "@/lib/validations/pemakaian"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"

interface ParsedRow {
  row: number
  idPelanggan: string
  nama?: string
  tarif: string
  daya: number
  bulan: number
  tahun: number
  kwh: number
  isToHistory: boolean
  dataLengkap: boolean
  status: "valid" | "invalid"
  error?: string
}

const BULAN_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5,
  JUN: 6, JUL: 7, AGU: 8, AUG: 8, SEP: 9, OKT: 10,
  OCT: 10, NOV: 11, DES: 12, DEC: 12,
}

function parseBulanTahun(blthValue: unknown): { bulan: number; tahun: number } | null {
  if (!blthValue) return null

  // Kalau Date object (dari Excel)
  if (blthValue instanceof Date) {
    return {
      bulan: blthValue.getMonth() + 1,
      tahun: blthValue.getFullYear(),
    }
  }

  // Kalau number (Excel serial date)
  if (typeof blthValue === "number") {
    const excelEpoch = new Date(1900, 0, 1)
    const days = blthValue - 2
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
    return {
      bulan: date.getMonth() + 1,
      tahun: date.getFullYear(),
    }
  }

  const clean = String(blthValue).trim().toUpperCase()

  // Format: "Apr-26", "APR-2026"
  const match1 = clean.match(/^([A-Z]+)[-\s](\d+)$/)
  if (match1) {
    const bulanStr = match1[1].substring(0, 3)
    const tahunStr = match1[2]
    const bulan = BULAN_MAP[bulanStr]
    if (!bulan) return null
    let tahun = parseInt(tahunStr)
    if (tahun < 100) tahun = 2000 + tahun
    return { bulan, tahun }
  }

  // Format: "01/2026", "1-2026"
  const match2 = clean.match(/^(\d{1,2})[\/-](\d{2,4})$/)
  if (match2) {
    const bulan = parseInt(match2[1])
    let tahun = parseInt(match2[2])
    if (tahun < 100) tahun = 2000 + tahun
    if (bulan >= 1 && bulan <= 12) return { bulan, tahun }
  }

  return null
}

export function ImportPemakaianForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])

  const validCount = parsedData.filter((r) => r.status === "valid").length
  const invalidCount = parsedData.filter((r) => r.status === "invalid").length
  const warningCount = parsedData.filter(
    (r) => r.status === "valid" && !r.dataLengkap
  ).length

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const validExtensions = [".xlsx", ".xls"]
    const isValid = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    )

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

  async function parseExcel(file: File) {
    setIsParsing(true)
    setParsedData([])

    try {
      // Load pelanggan untuk lookup
      const pelangganResponse = await fetch("/api/pelanggan?limit=10000")
      if (!pelangganResponse.ok) {
        throw new Error(`Gagal load data pelanggan (${pelangganResponse.status})`)
      }
      const pelangganData = await pelangganResponse.json()
      const pelangganMap = new Map<
        string,
        { nama: string; lokasi: string; tarif: string; daya: number; dataLengkap: boolean }
      >()

      if (pelangganData.data && Array.isArray(pelangganData.data)) {
        pelangganData.data.forEach((p: {
          idPelanggan: string
          nama: string
          lokasi: string
          tarif: string
          daya: number
          dataLengkap: boolean
        }) => {
          pelangganMap.set(p.idPelanggan, {
            nama: p.nama,
            lokasi: p.lokasi,
            tarif: p.tarif,
            daya: p.daya,
            dataLengkap: p.dataLengkap,
          })
        })
      }

      // Load TO Historis
      const toResponse = await fetch("/api/to-historis?limit=10000")
      const toSet = new Set<string>()

      if (toResponse.ok) {
        const toData = await toResponse.json()
        if (toData.data && Array.isArray(toData.data)) {
          toData.data.forEach((t: { idPelanggan: string }) => {
            toSet.add(t.idPelanggan)
          })
        }
      }

      // Read Excel
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      })
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
              ""
          )
        )

        const tarif = String(
          row["TRF"] ?? row["TARIF"] ?? row["tarif"] ?? "R1"
        ).trim()

        const dayaRaw =
          row["DAYA"] ?? row["Daya"] ?? row["daya"] ?? 900
        const daya = Number(dayaRaw) || 900

        const blthValue = row["BLTH REK"] ?? row["BLTH_REK"] ?? row["Periode"]

        let bulan = 0
        let tahun = 0

        const parsed = parseBulanTahun(blthValue)
        if (parsed) {
          bulan = parsed.bulan
          tahun = parsed.tahun
        } else {
          // Fallback: cek bulan & tahun terpisah
          bulan = Number(row["Bulan"] ?? row["bulan"]) || 0
          tahun = Number(row["Tahun"] ?? row["tahun"]) || 0
        }

        const kwhRaw =
          row["PEMKWH"] ??
          row["kWh"] ??
          row["KWH"] ??
          row["Pemakaian"]
        const kwh = Number(kwhRaw)

        const pelangganInfo = pelangganMap.get(idPelanggan)
        const isToHistory = toSet.has(idPelanggan)
        const dataLengkap = !!(pelangganInfo?.dataLengkap)

        let status: "valid" | "invalid" = "valid"
        let error: string | undefined

        if (!idPelanggan) {
          status = "invalid"
          error = "IDPEL kosong"
        } else if (!/^\d+$/.test(idPelanggan)) {
          status = "invalid"
          error = "IDPEL harus angka"
        } else if (!bulan || bulan < 1 || bulan > 12) {
          status = "invalid"
          error = `Bulan tidak valid`
        } else if (!tahun || tahun < 2020 || tahun > 2030) {
          status = "invalid"
          error = `Tahun tidak valid`
        } else if (isNaN(kwh) || kwh < 0) {
          status = "invalid"
          error = `kWh tidak valid`
        }

        return {
          row: rowNum,
          idPelanggan,
          nama: pelangganInfo?.nama,
          tarif: pelangganInfo?.tarif || tarif,
          daya: pelangganInfo?.daya || daya,
          bulan,
          tahun,
          kwh,
          isToHistory,
          dataLengkap,
          status,
          error,
        }
      })

      setParsedData(parsed)

      const valid = parsed.filter((r) => r.status === "valid").length
      const invalid = parsed.filter((r) => r.status === "invalid").length
      const noDil = parsed.filter((r) => r.status === "valid" && !r.dataLengkap).length

      if (valid === 0) {
        toast.error("Tidak ada data valid")
      } else {
        toast.success(`${valid} valid, ${invalid} error${noDil > 0 ? `, ${noDil} pelanggan belum lengkap` : ""}`)
      }
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Gagal membaca file", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
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
          tarif: row.tarif,
          daya: row.daya,
          bulan: row.bulan,
          tahun: row.tahun,
          kwh: row.kwh,
        })),
      }

      const response = await fetch("/api/pemakaian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      // Cek apakah response valid JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 500))
        throw new Error(`Server error: response bukan JSON (status ${response.status})`)
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Gagal import")
      }

      toast.success("Import pemakaian berhasil!", {
        description: `${result.inserted + result.updated} data, ${result.pelangganAutoCreated || 0} pelanggan baru`,
      })

      router.push("/pemakaian")
      router.refresh()
    } catch (error) {
      console.error("Import error:", error)
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
    const templateData = [
      { IDPEL: "5461009543", TRF: "R1", DAYA: 900, "BLTH REK": "Jan-26", PEMKWH: 250 },
      { IDPEL: "5461009544", TRF: "B2", DAYA: 2200, "BLTH REK": "Jan-26", PEMKWH: 450 },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Pemakaian")
    worksheet["!cols"] = [{ wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 10 }]
    XLSX.writeFile(workbook, "template-pemakaian.xlsx")
    toast.success("Template berhasil diunduh")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Petunjuk Import Pemakaian</CardTitle>
          <CardDescription>Import dari file Excel AP2T PLN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-md">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              Format Kolom Excel:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 ml-4 list-disc">
              <li><strong>IDPEL</strong> — ID pelanggan (wajib)</li>
              <li><strong>TRF</strong> — Golongan tarif</li>
              <li><strong>DAYA</strong> — Daya dalam VA</li>
              <li><strong>BLTH REK</strong> — Format &quot;Apr-26&quot; atau &quot;Jan-2025&quot;</li>
              <li><strong>PEMKWH</strong> — Pemakaian dalam kWh</li>
            </ul>
          </div>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="pemakaian-upload"
              />
              <label
                htmlFor="pemakaian-upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer"
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
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm text-muted-foreground">Memproses...</p>
          </CardContent>
        </Card>
      )}

      {!isParsing && parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview Data</CardTitle>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-md bg-green-100 text-green-800 text-sm font-medium">
                  {validCount} Valid
                </span>
                {invalidCount > 0 && (
                  <span className="px-3 py-1 rounded-md bg-red-100 text-red-800 text-sm font-medium">
                    {invalidCount} Error
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-3 py-1 rounded-md bg-amber-100 text-amber-800 text-sm font-medium">
                    {warningCount} Perlu Lengkapi
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left text-xs font-semibold">Row</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold">IDPEL</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold">Nama</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold">Periode</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold">kWh</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold">TO</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row) => (
                    <tr
                      key={row.row}
                      className={`border-b ${
                        row.status === "invalid"
                          ? "bg-red-50 dark:bg-red-950/20"
                          : !row.dataLengkap
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-xs">{row.row}</td>
                      <td className="px-2 py-2 text-xs font-mono">{row.idPelanggan || "-"}</td>
                      <td className="px-2 py-2 text-xs">
                        {row.nama ? row.nama : (
                          <span className="text-amber-600 italic">⚠️ Auto-create</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.bulan && row.tahun
                          ? `${NAMA_BULAN[row.bulan - 1] ?? "?"} ${row.tahun}`
                          : "-"}
                      </td>
                      <td className="px-2 py-2 text-xs text-right font-mono">
                        {!isNaN(row.kwh) ? row.kwh.toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.isToHistory && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                            TO
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.status === "valid" ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
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
              <Button variant="outline" onClick={handleReset} disabled={isImporting}>
                Batal
              </Button>
              <Button
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