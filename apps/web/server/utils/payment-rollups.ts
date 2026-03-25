export const ROLLUP_ALL_YEARS = 0

export function getRollupScopeFiscalYear(fiscalYear?: number | null) {
  return fiscalYear ?? ROLLUP_ALL_YEARS
}
