/**
 * Anomaly detection for kWh consumption patterns.
 *
 * This replaces the external Python ML service with rule-based detection
 * that runs inside the Next.js server. The patterns match those stored in
 * the `Temuan` table:
 *
 *   - TURUN_DRASTIS  : current month < 50% of 6-month average
 *   - STAGNAN        : same kWh for 3 consecutive months
 *   - NOL_PEMAKAIAN  : 0 kWh for 2 consecutive months
 *   - LONJAKAN       : current month > 300% of previous month
 */

import type { TipeAnomali } from "@/lib/generated/prisma/enums"

export interface PemakaianSample {
  bulan: number
  tahun: number
  kwh: number
}

export interface AnomalyHit {
  tipeAnomali: TipeAnomali
  alasan: string
  /** 0..1 — higher is more suspicious */
  skor: number
}

const TURUN_THRESHOLD = 0.5 // current < 50% of avg
const LONJAKAN_THRESHOLD = 3.0 // current > 300% of previous
const STAGNAN_MONTHS = 3
const NOL_MONTHS = 2

/**
 * Sort pemakaian ascending by (tahun, bulan) and return the latest N samples.
 */
function sortPemakaian(items: PemakaianSample[]): PemakaianSample[] {
  return [...items].sort((a, b) =>
    a.tahun === b.tahun ? a.bulan - b.bulan : a.tahun - b.tahun
  )
}

function detectTurunDrastis(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < 4) return null
  const last = sorted[sorted.length - 1]
  const historyWindow = sorted.slice(-7, -1) // up to 6 months before "last"
  if (historyWindow.length < 3) return null

  const avg =
    historyWindow.reduce((a, b) => a + b.kwh, 0) / historyWindow.length
  if (avg <= 0) return null

  const ratio = last.kwh / avg
  if (ratio >= TURUN_THRESHOLD) return null

  const drop = Math.round((1 - ratio) * 100)
  return {
    tipeAnomali: "TURUN_DRASTIS",
    alasan: `Pemakaian bulan ${last.bulan}/${last.tahun} turun ${drop}% (${last.kwh.toLocaleString("id-ID")} kWh) dibanding rata-rata ${historyWindow.length} bulan sebelumnya (${avg.toFixed(0)} kWh).`,
    skor: Math.min(1, 1 - ratio),
  }
}

function detectStagnan(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < STAGNAN_MONTHS) return null
  const tail = sorted.slice(-STAGNAN_MONTHS)
  const first = tail[0].kwh
  if (first <= 0) return null

  const allSame = tail.every((p) => Math.abs(p.kwh - first) < 0.01)
  if (!allSame) return null

  return {
    tipeAnomali: "STAGNAN",
    alasan: `Pemakaian persis sama (${first.toLocaleString("id-ID")} kWh) selama ${STAGNAN_MONTHS} bulan berturut-turut.`,
    skor: 0.85,
  }
}

function detectNolPemakaian(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < NOL_MONTHS) return null
  const tail = sorted.slice(-NOL_MONTHS)
  const allZero = tail.every((p) => p.kwh === 0)
  if (!allZero) return null

  return {
    tipeAnomali: "NOL_PEMAKAIAN",
    alasan: `Pemakaian 0 kWh selama ${NOL_MONTHS} bulan berturut-turut (${tail[0].bulan}/${tail[0].tahun} – ${tail[tail.length - 1].bulan}/${tail[tail.length - 1].tahun}).`,
    skor: 1.0,
  }
}

function detectLonjakan(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < 2) return null
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  if (prev.kwh <= 0) return null

  const ratio = last.kwh / prev.kwh
  if (ratio < LONJAKAN_THRESHOLD) return null

  const naik = Math.round((ratio - 1) * 100)
  return {
    tipeAnomali: "LONJAKAN",
    alasan: `Pemakaian bulan ${last.bulan}/${last.tahun} melonjak ${naik}% (dari ${prev.kwh.toLocaleString("id-ID")} ke ${last.kwh.toLocaleString("id-ID")} kWh).`,
    skor: Math.min(1, (ratio - 1) / 5),
  }
}

/**
 * Run every detector and return the strongest match (highest skor) for a
 * single pelanggan. Returns null if no anomaly is detected.
 */
export function detectAnomaly(items: PemakaianSample[]): AnomalyHit | null {
  if (!items || items.length === 0) return null

  const sorted = sortPemakaian(items)

  const hits: AnomalyHit[] = []
  const nol = detectNolPemakaian(sorted)
  if (nol) hits.push(nol)
  const turun = detectTurunDrastis(sorted)
  if (turun) hits.push(turun)
  const lonjak = detectLonjakan(sorted)
  if (lonjak) hits.push(lonjak)
  const stagnan = detectStagnan(sorted)
  if (stagnan) hits.push(stagnan)

  if (hits.length === 0) return null

  // Strongest first
  hits.sort((a, b) => b.skor - a.skor)
  return hits[0]
}

/**
 * Return the periode string ("MM-YYYY") of the most recent pemakaian sample.
 */
export function getPeriode(items: PemakaianSample[]): string {
  if (!items.length) {
    const now = new Date()
    return `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`
  }
  const sorted = sortPemakaian(items)
  const last = sorted[sorted.length - 1]
  return `${String(last.bulan).padStart(2, "0")}-${last.tahun}`
}

export const ANOMALY_LABEL: Record<TipeAnomali, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
}

export const ANOMALY_COLOR: Record<TipeAnomali, string> = {
  TURUN_DRASTIS: "amber",
  STAGNAN: "blue",
  NOL_PEMAKAIAN: "red",
  LONJAKAN: "purple",
  POLA_TIDAK_WAJAR: "slate",
}
