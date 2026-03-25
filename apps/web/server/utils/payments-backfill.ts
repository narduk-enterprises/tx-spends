import { sql } from 'drizzle-orm'
import type { useAppDatabase } from '#server/utils/database'
import { fiscalYears } from '#server/database/schema'

type AppDatabase = ReturnType<typeof useAppDatabase>

export async function isPaymentsBackfillActive(db: AppDatabase) {
  const [state] = await db
    .select({
      active: sql<boolean>`exists(
        select 1
        from pg_stat_activity
        where state = 'active'
          and query ilike 'INSERT INTO state_payment_facts%'
      )`.as('active'),
    })
    .from(fiscalYears)
    .limit(1)

  return Boolean(state?.active)
}
