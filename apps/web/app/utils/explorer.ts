import type { LocationQueryRaw, LocationQueryValueRaw } from 'vue-router'

export const EXPLORER_APP_NAME = 'Texas State Spending Explorer'

export const DEFAULT_PAGE_SIZE = 25
const specialCountyDisplayNames: Record<string, string> = {
  DEWITT: 'DeWitt',
  INTEX: 'In Texas',
  INTEXAS: 'In Texas',
  LASALLE: 'La Salle',
  MCCULLOCH: 'McCulloch',
  MCLENNAN: 'McLennan',
  MCMULLEN: 'McMullen',
  RAINES: 'Rains',
}
const nonCountyGeographyKeys = new Set(['INTEX', 'INTEXAS'])

function getCurrentTexasFiscalYear() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())

  const month = Number(parts.find((part) => part.type === 'month')?.value || '1')
  const year = Number(
    parts.find((part) => part.type === 'year')?.value || String(new Date().getFullYear()),
  )

  return month >= 9 ? year + 1 : year
}

const currentTexasFiscalYear = getCurrentTexasFiscalYear()

export const FISCAL_YEAR_OPTIONS = [
  { label: 'All fiscal years', value: 'all' },
  ...Array.from({ length: 10 }, (_, index) => {
    const fiscalYear = currentTexasFiscalYear - index
    return {
      label: `FY ${fiscalYear}`,
      value: String(fiscalYear),
    }
  }),
]

export function buildFiscalYearOptions(
  years: Array<number | null | undefined>,
  allLabel = 'All fiscal years',
) {
  const normalizedYears = [
    ...new Set(years.filter((year): year is number => Number.isFinite(year))),
  ]
    .sort((left, right) => right - left)
    .map((fiscalYear) => ({
      label: `FY ${fiscalYear}`,
      value: String(fiscalYear),
    }))

  return [{ label: allLabel, value: 'all' }, ...normalizedYears]
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replaceAll(',', ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function normalizeString(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  return ''
}

export function formatUsd(value: unknown, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(normalizeNumber(value))
}

export function formatUsdCompact(value: unknown) {
  const numericValue = normalizeNumber(value)
  const absoluteValue = Math.abs(numericValue)
  const sign = numericValue < 0 ? '-' : ''
  const units = [
    { threshold: 1e12, suffix: 'T' },
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' },
  ]

  for (const unit of units) {
    if (absoluteValue >= unit.threshold) {
      const scaledValue = absoluteValue / unit.threshold
      const fractionDigits = scaledValue >= 100 ? 0 : 1

      return `${sign}$${scaledValue.toFixed(fractionDigits)}${unit.suffix}`
    }
  }

  if (absoluteValue >= 100) {
    return `${sign}${formatUsd(absoluteValue, 0)}`
  }

  return `${sign}${formatUsd(absoluteValue, absoluteValue >= 10 ? 1 : 2)}`
}

export function formatCount(value: unknown) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(normalizeNumber(value))
}

export function formatDurationShort(totalSeconds: unknown) {
  const safeSeconds = Math.max(0, Math.floor(normalizeNumber(totalSeconds)))

  if (safeSeconds <= 0) {
    return 'Starting…'
  }

  const days = Math.floor(safeSeconds / 86_400)
  const hours = Math.floor((safeSeconds % 86_400) / 3_600)
  const minutes = Math.floor((safeSeconds % 3_600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return `${safeSeconds}s`
}

export function formatFiscalYearCoverage(years: Array<number | null | undefined>) {
  const normalizedYears = [
    ...new Set(years.filter((year): year is number => Number.isFinite(year))),
  ].sort((left, right) => left - right)

  if (normalizedYears.length === 0) {
    return 'No fiscal years'
  }

  if (normalizedYears.length === 1) {
    return `FY ${normalizedYears[0]}`
  }

  return `FY ${normalizedYears[0]}–${normalizedYears.at(-1)}`
}

export function formatCountyDisplayName(value: unknown, fallback = 'Unknown') {
  const normalizedValue = normalizeString(value).trim()

  if (!normalizedValue) {
    return fallback
  }

  const compactKey = normalizedValue.toUpperCase().replaceAll(/\s+/g, '')
  if (specialCountyDisplayNames[compactKey]) {
    return specialCountyDisplayNames[compactKey]
  }

  return normalizedValue.toLowerCase().replaceAll(/\b\w/g, (letter) => letter.toUpperCase())
}

export function normalizeCountyKey(value: unknown) {
  const normalizedValue = normalizeString(value).trim()

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue
    .toUpperCase()
    .replaceAll(/\bCOUNTY\b/g, '')
    .replaceAll(/[^A-Z0-9]/g, '')
    .trim()
}

export function formatCountyLabel(value: unknown, fallback = 'Unknown') {
  const displayName = formatCountyDisplayName(value, fallback)
  const compactKey = normalizeCountyKey(value)

  if (nonCountyGeographyKeys.has(compactKey)) {
    return displayName
  }

  return `${displayName} County`
}

export function getStringQueryValue(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return
  }

  return value
}

export function getNumberQueryValue(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return
  }

  return parsed
}

export function getBooleanQueryValue(value: unknown) {
  return value === 'true' || value === '1'
}

type CleanQueryInputValue = LocationQueryValueRaw | LocationQueryValueRaw[] | null | undefined

export function cleanQueryObject(query: Record<string, CleanQueryInputValue>): LocationQueryRaw {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false
      }

      if (Array.isArray(value)) {
        return value.length > 0
      }

      if (typeof value === 'string') {
        return value.length > 0
      }

      return true
    }),
  ) as LocationQueryRaw
}

function serializeFetchKeyValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return
  }

  if (Array.isArray(value)) {
    const normalizedValues = value
      .map((item) => serializeFetchKeyValue(item))
      .filter((item): item is string => Boolean(item))

    return normalizedValues.length > 0 ? normalizedValues.join(',') : undefined
  }

  if (typeof value === 'string') {
    return value.length > 0 ? encodeURIComponent(value) : undefined
  }

  return encodeURIComponent(String(value))
}

export function buildFetchKey(prefix: string, params?: Record<string, unknown>) {
  if (!params) {
    return prefix
  }

  const serializedParams = Object.entries(params)
    .flatMap(([key, value]) => {
      const serializedValue = serializeFetchKeyValue(value)
      return serializedValue ? [`${key}=${serializedValue}`] : []
    })
    .sort((left, right) => left.localeCompare(right))

  return serializedParams.length > 0 ? `${prefix}:${serializedParams.join('&')}` : prefix
}

export function offsetToPage(offset: number | undefined, limit = DEFAULT_PAGE_SIZE) {
  if (!offset || offset <= 0) {
    return 1
  }

  return Math.floor(offset / limit) + 1
}

export function pageToOffset(page: number, limit = DEFAULT_PAGE_SIZE) {
  return Math.max(0, page - 1) * limit
}
