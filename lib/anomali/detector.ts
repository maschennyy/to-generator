/**
 * Anomaly detection for kWh consumption patterns.
 *
 * Detectors:
 *   - TURUN_DRASTIS    : current month < 50% of 6-month average
 *   - STAGNAN          : same kWh for 3 consecutive months
 *   - NOL_PEMAKAIAN    : 0 kWh for 2 consecutive months
 *   - LONJAKAN         : current month > 300% of previous month
 *   - POLA_TIDAK_WAJAR : 3 sub-pola —
 *       (a) Naik-Turun Ekstrem  : zigzag besar berulang selama ≥ 4 bulan
 *       (b) Meter Statis        : nilai selalu angka bulat genap ratusan/ribuan
 *       (c) Penurunan Bertahap  : tren turun konsisten > 5 bulan, total > 40%
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

// ── Threshold constants ───────────────────────────────────────────────────────
const TURUN_THRESHOLD = 0.5       // current < 50% of avg
const LONJAKAN_THRESHOLD = 3.0    // current > 300% of previous
const STAGNAN_MONTHS = 3
const NOL_MONTHS = 2

// POLA_TIDAK_WAJAR thresholds
const ZIGZAG_MIN_MONTHS = 4       // minimal 4 bulan untuk pola zigzag
const ZIGZAG_SWING_RATIO = 0.4    // perubahan ≥ 40% dianggap ayunan besar
const ZIGZAG_MIN_REVERSALS = 3    // minimal 3 kali balik arah
const STATIS_MIN_MONTHS = 4       // minimal 4 bulan untuk cek meter statis
const STATIS_ROUND_DIVISOR = 50   // semua nilai habis dibagi 50
const TURUN_BERTAHAP_MONTHS = 5   // minimal 5 bulan tren turun
const TURUN_BERTAHAP_TOTAL = 0.4  // total penurunan ≥ 40%

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortPemakaian(items: PemakaianSample[]): PemakaianSample[] {
  return [...items].sort((a, b) =>
    a.tahun === b.tahun ? a.bulan - b.bulan : a.tahun - b.tahun
  )
}

function fmt(kwh: number): string {
  return kwh.toLocaleString("id-ID")
}

// ── Existing detectors ────────────────────────────────────────────────────────

function detectNolPemakaian(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < NOL_MONTHS) return null
  const tail = sorted.slice(-NOL_MONTHS)
  if (!tail.every((p) => p.kwh === 0)) return null

  return {
    tipeAnomali: "NOL_PEMAKAIAN",
    alasan: `Pemakaian 0 kWh selama ${NOL_MONTHS} bulan berturut-turut (${tail[0].bulan}/${tail[0].tahun} – ${tail[tail.length - 1].bulan}/${tail[tail.length - 1].tahun}).`,
    skor: 1.0,
  }
}

function detectTurunDrastis(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < 4) return null
  const last = sorted[sorted.length - 1]
  const historyWindow = sorted.slice(-7, -1)
  if (historyWindow.length < 3) return null

  const avg = historyWindow.reduce((a, b) => a + b.kwh, 0) / historyWindow.length
  if (avg <= 0) return null

  const ratio = last.kwh / avg
  if (ratio >= TURUN_THRESHOLD) return null

  const drop = Math.round((1 - ratio) * 100)
  return {
    tipeAnomali: "TURUN_DRASTIS",
    alasan: `Pemakaian bulan ${last.bulan}/${last.tahun} turun ${drop}% (${fmt(last.kwh)} kWh) dibanding rata-rata ${historyWindow.length} bulan sebelumnya (${avg.toFixed(0)} kWh).`,
    skor: Math.min(1, 1 - ratio),
  }
}

function detectStagnan(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < STAGNAN_MONTHS) return null
  const tail = sorted.slice(-STAGNAN_MONTHS)
  const first = tail[0].kwh
  if (first <= 0) return null
  if (!tail.every((p) => Math.abs(p.kwh - first) < 0.01)) return null

  return {
    tipeAnomali: "STAGNAN",
    alasan: `Pemakaian persis sama (${fmt(first)} kWh) selama ${STAGNAN_MONTHS} bulan berturut-turut.`,
    skor: 0.85,
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
    alasan: `Pemakaian bulan ${last.bulan}/${last.tahun} melonjak ${naik}% (dari ${fmt(prev.kwh)} ke ${fmt(last.kwh)} kWh).`,
    skor: Math.min(1, (ratio - 1) / 5),
  }
}

// ── POLA_TIDAK_WAJAR — 3 sub-detektor ─────────────────────────────────────────

/**
 * (a) Naik-Turun Ekstrem (Zigzag)
 *
 * Mendeteksi pelanggan yang pemakaiannya naik dan turun besar secara
 * bergantian — indikasi kemungkinan manipulasi pembacaan meter.
 *
 * Kriteria: ≥ ZIGZAG_MIN_REVERSALS kali balik arah dengan setiap
 * perubahan ≥ ZIGZAG_SWING_RATIO (40%) dari nilai sebelumnya.
 */
function detectZigzag(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < ZIGZAG_MIN_MONTHS) return null

  const window = sorted.slice(-ZIGZAG_MIN_MONTHS - 2)
  if (window.length < ZIGZAG_MIN_MONTHS) return null

  let reversals = 0
  let prevDirection = 0 // -1 turun, +1 naik

  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].kwh
    const curr = window[i].kwh
    if (prev <= 0) continue

    const change = (curr - prev) / prev
    if (Math.abs(change) < ZIGZAG_SWING_RATIO) continue // ayunan kecil, abaikan

    const dir = change > 0 ? 1 : -1
    if (prevDirection !== 0 && dir !== prevDirection) {
      reversals++
    }
    prevDirection = dir
  }

  if (reversals < ZIGZAG_MIN_REVERSALS) return null

  const first = window[0]
  const last = window[window.length - 1]
  return {
    tipeAnomali: "POLA_TIDAK_WAJAR",
    alasan: `Pola naik-turun ekstrem (zigzag) terdeteksi sebanyak ${reversals} kali balik arah dalam ${window.length} bulan (${first.bulan}/${first.tahun}–${last.bulan}/${last.tahun}). Indikasi pembacaan meter tidak konsisten.`,
    skor: Math.min(1, 0.6 + reversals * 0.08),
  }
}

/**
 * (b) Meter Statis (Nilai Bulat Terus-Menerus)
 *
 * Mendeteksi pelanggan yang nilai pemakaiannya selalu angka bulat
 * habis dibagi 50 (mis. 100, 150, 200) selama ≥ STATIS_MIN_MONTHS bulan.
 * Meter normal menghasilkan nilai acak — nilai yang selalu bulat sempurna
 * mengindikasikan meter tidak berputar atau dicatat manual secara tetap.
 */
function detectMeterStatis(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < STATIS_MIN_MONTHS) return null

  const window = sorted.slice(-STATIS_MIN_MONTHS)

  // Semua nilai harus > 0 (beda dari NOL_PEMAKAIAN) dan habis dibagi 50
  const allRound = window.every(
    (p) => p.kwh > 0 && p.kwh % STATIS_ROUND_DIVISOR === 0
  )
  if (!allRound) return null

  // Tambahan: nilai tidak boleh semuanya persis sama (itu sudah STAGNAN)
  const uniqueValues = new Set(window.map((p) => p.kwh))
  if (uniqueValues.size === 1) return null

  const values = window.map((p) => fmt(p.kwh)).join(", ")
  return {
    tipeAnomali: "POLA_TIDAK_WAJAR",
    alasan: `Nilai pemakaian selalu bilangan bulat kelipatan ${STATIS_ROUND_DIVISOR} selama ${STATIS_MIN_MONTHS} bulan terakhir (${values} kWh). Indikasi meter statis atau pencatatan manual tidak wajar.`,
    skor: 0.72,
  }
}

/**
 * (c) Penurunan Bertahap (Gradual Decline)
 *
 * Mendeteksi tren penurunan yang konsisten selama ≥ TURUN_BERTAHAP_MONTHS
 * bulan dengan total penurunan ≥ TURUN_BERTAHAP_TOTAL (40%).
 * Berbeda dari TURUN_DRASTIS yang tiba-tiba dalam 1 bulan — ini adalah
 * penurunan perlahan yang sering luput dari perhatian petugas.
 */
function detectPenurunanBertahap(sorted: PemakaianSample[]): AnomalyHit | null {
  if (sorted.length < TURUN_BERTAHAP_MONTHS) return null

  const window = sorted.slice(-TURUN_BERTAHAP_MONTHS)
  const first = window[0].kwh
  const last = window[window.length - 1].kwh

  if (first <= 0) return null

  // Setiap bulan harus lebih rendah dari bulan sebelumnya
  const isConsistentlyDecreasing = window.every(
    (p, i) => i === 0 || p.kwh < window[i - 1].kwh
  )
  if (!isConsistentlyDecreasing) return null

  const totalDrop = (first - last) / first
  if (totalDrop < TURUN_BERTAHAP_TOTAL) return null

  const dropPct = Math.round(totalDrop * 100)
  const startPeriode = `${window[0].bulan}/${window[0].tahun}`
  const endPeriode = `${window[window.length - 1].bulan}/${window[window.length - 1].tahun}`

  return {
    tipeAnomali: "POLA_TIDAK_WAJAR",
    alasan: `Penurunan bertahap konsisten selama ${TURUN_BERTAHAP_MONTHS} bulan (${startPeriode}–${endPeriode}): dari ${fmt(first)} turun ke ${fmt(last)} kWh (total −${dropPct}%). Indikasi penurunan beban atau potensi bypass meter bertahap.`,
    skor: Math.min(1, 0.55 + totalDrop * 0.5),
  }
}

/**
 * Gabungkan ketiga sub-detektor POLA_TIDAK_WAJAR dan ambil yang tertinggi.
 */
function detectPolaTidakWajar(sorted: PemakaianSample[]): AnomalyHit | null {
  const candidates: AnomalyHit[] = []

  const zigzag = detectZigzag(sorted)
  if (zigzag) candidates.push(zigzag)

  const statis = detectMeterStatis(sorted)
  if (statis) candidates.push(statis)

  const turunBertahap = detectPenurunanBertahap(sorted)
  if (turunBertahap) candidates.push(turunBertahap)

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.skor - a.skor)
  return candidates[0]
}

// ── Main export ───────────────────────────────────────────────────────────────

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

  const pola = detectPolaTidakWajar(sorted)
  if (pola) hits.push(pola)

  if (hits.length === 0) return null

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