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
  const normalizedYears = [...new Set(years.filter((year): year is number => Number.isFinite(year)))]
    .sort((left, right) => right - left)
    .map((fiscalYear) => ({
      label: `FY ${fiscalYear}`,
      value: String(fiscalYear),
    }))

  return [{ label: allLabel, value: 'all' }, ...normalizedYears]
}

export function formatUsd(value: number | null | undefined, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(Number(value || 0))
}

export function formatUsdCompact(value: number | null | undefined) {
  const numericValue = Number(value || 0)
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

export function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export function formatCountyDisplayName(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) {
    return fallback
  }

  const compactKey = value.toUpperCase().replaceAll(/\s+/g, '')
  if (specialCountyDisplayNames[compactKey]) {
    return specialCountyDisplayNames[compactKey]
  }

  return value.toLowerCase().replaceAll(/\b\w/g, (letter) => letter.toUpperCase())
}

export function normalizeCountyKey(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return value
    .toUpperCase()
    .replaceAll(/\bCOUNTY\b/g, '')
    .replaceAll(/[^A-Z0-9]/g, '')
    .trim()
}

export function formatCountyLabel(value: string | null | undefined, fallback = 'Unknown') {
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

export function offsetToPage(offset: number | undefined, limit = DEFAULT_PAGE_SIZE) {
  if (!offset || offset <= 0) {
    return 1
  }

  return Math.floor(offset / limit) + 1
}

export function pageToOffset(page: number, limit = DEFAULT_PAGE_SIZE) {
  return Math.max(0, page - 1) * limit
}
