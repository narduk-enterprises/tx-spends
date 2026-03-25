import { sql } from 'drizzle-orm'
import type { useAppDatabase } from '#server/utils/database'
import { fiscalYears } from '#server/database/schema'

type AppDatabase = ReturnType<typeof useAppDatabase>

const PAYMENTS_EXPORT_SUMMARY = {
  source_file_count: 116,
  source_row_count: 27_602_538,
  fiscal_years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
} as const

export type PaymentsBackfillStatus = {
  active: boolean
  source_file_count: number
  source_row_count: number
  fiscal_years: number[]
  active_runtime_seconds: number | null
}

export async function getPaymentsBackfillStatus(db: AppDatabase): Promise<PaymentsBackfillStatus> {
  const [estimate] = await db
    .select({
      estimated_row_count: sql<number>`coalesce((
        select reltuples::bigint
        from pg_class
        where relname = 'state_payment_facts'
      ), 0)`.as('estimated_row_count'),
    })
    .from(fiscalYears)
    .limit(1)

  const estimatedRowCount = Number(estimate?.estimated_row_count || 0)
  const likelyIncomplete =
    estimatedRowCount > 0 && estimatedRowCount < PAYMENTS_EXPORT_SUMMARY.source_row_count * 0.995

  let activeRuntimeSeconds: number | null = null
  let active = likelyIncomplete

  if (likelyIncomplete) {
    try {
      const [state] = await db
        .select({
          active: sql<boolean>`exists(
            select 1
            from pg_stat_activity
            where state = 'active'
              and query ilike 'INSERT INTO state_payment_facts%'
          )`.as('active'),
          active_runtime_seconds: sql<number | null>`(
            select extract(epoch from age(clock_timestamp(), min(query_start)))::integer
            from pg_stat_activity
            where state = 'active'
              and query ilike 'INSERT INTO state_payment_facts%'
          )`.as('active_runtime_seconds'),
        })
        .from(fiscalYears)
        .limit(1)

      active = Boolean(state?.active)
      activeRuntimeSeconds = state?.active_runtime_seconds
        ? Number(state.active_runtime_seconds)
        : null
    } catch {
      active = likelyIncomplete
    }
  }

  return {
    ...PAYMENTS_EXPORT_SUMMARY,
    fiscal_years: [...PAYMENTS_EXPORT_SUMMARY.fiscal_years],
    active,
    active_runtime_seconds: activeRuntimeSeconds,
  }
}

export async function isPaymentsBackfillActive(db: AppDatabase) {
  const status = await getPaymentsBackfillStatus(db)
  return status.active
}
