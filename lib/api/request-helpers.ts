export function parsePositiveIntParam(
  value: string | null,
  fallback: number,
  options: { min?: number; max?: number } = {}
) {
  const min = options.min ?? 1
  const parsed = Number.parseInt(value ?? "", 10)
  const safeValue = Number.isFinite(parsed) ? parsed : fallback
  return Math.min(Math.max(safeValue, min), options.max ?? safeValue)
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {}
) {
  const page = parsePositiveIntParam(searchParams.get("page"), 1, { min: 1 })
  const limit = parsePositiveIntParam(searchParams.get("limit"), options.defaultLimit ?? 20, {
    min: 1,
    max: options.maxLimit ?? 100,
  })

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  }
}

export function parseOptionalPositiveInt(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function validateSpreadsheetFile(file: File, maxBytes = DEFAULT_MAX_UPLOAD_BYTES) {
  if (file.size <= 0) {
    return "File kosong"
  }

  if (file.size > maxBytes) {
    return `Ukuran file terlalu besar. Maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`
  }

  const name = file.name.toLowerCase()
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    return "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv."
  }

  return null
}
