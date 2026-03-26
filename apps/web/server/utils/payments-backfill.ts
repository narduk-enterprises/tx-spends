import { sql } from 'drizzle-orm'
import type { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts } from '#server/database/schema'

type AppDatabase = ReturnType<typeof useAppDatabase>

const PAYMENTS_EXPORT_SUMMARY = {
  source_file_count: 116,
  source_row_count: 27_602_538,
  fiscal_years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
} as const

export type PaymentsBackfillStatus = {
  active: boolean
  row_count: number
  source_file_count: number
  source_row_count: number
  fiscal_years: number[]
  active_runtime_seconds: number | null
}

export async function getPaymentsBackfillStatus(db: AppDatabase): Promise<PaymentsBackfillStatus> {
  const [estimate] = await db
    .select({
      estimated_row_count: sql<number>`count(*)`.as('estimated_row_count'),
    })
    .from(statePaymentFacts)

  const estimatedRowCount = Number(estimate?.estimated_row_count || 0)
  const active =
    estimatedRowCount > 0 && estimatedRowCount < PAYMENTS_EXPORT_SUMMARY.source_row_count * 0.995

  return {
    ...PAYMENTS_EXPORT_SUMMARY,
    fiscal_years: [...PAYMENTS_EXPORT_SUMMARY.fiscal_years],
    row_count: estimatedRowCount,
    active,
    // Retained for API backward compatibility; runtime tracking was removed
    // along with the pg_stat_activity dependency.
    active_runtime_seconds: null,
  }
}

export async function isPaymentsBackfillActive(db: AppDatabase) {
  const status = await getPaymentsBackfillStatus(db)
  return status.active
}
