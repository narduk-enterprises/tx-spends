import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { BACKFILL_THRESHOLD, PAYMENTS_EXPORT_SUMMARY } from '#server/utils/payments-backfill'
import { ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import {
  countyExpenditureFacts,
  ingestionRuns,
  payeeVendorMatches,
  payees,
  paymentOverviewRollups,
} from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)

  const [paymentRollupRows, countyAggRows, payeeTotalRows, payeeMatchedRows, latestIngestionRows] =
    await Promise.all([
      // Use the pre-computed rollup table — avoids a full scan of the ~27.6M-row fact table.
      // The all-years row (scopeFiscalYear=0) provides total/public counts and last-updated time.
      // Per-year rows provide the list of loaded fiscal years.
      db
        .select({
          scopeFiscalYear: paymentOverviewRollups.scopeFiscalYear,
          paymentCountAll: paymentOverviewRollups.paymentCountAll,
          paymentCountPublic: paymentOverviewRollups.paymentCountPublic,
          updatedAt: paymentOverviewRollups.updatedAt,
        })
        .from(paymentOverviewRollups)
        .orderBy(paymentOverviewRollups.scopeFiscalYear),

      db
        .select({
          totalCount: sql<number>`count(*)`,
          latestLoad: sql<string | null>`MAX(${countyExpenditureFacts.sourceLoadedAt})`,
          fiscalYears: sql<
            number[]
          >`array_agg(DISTINCT ${countyExpenditureFacts.fiscalYear} ORDER BY ${countyExpenditureFacts.fiscalYear})`,
        })
        .from(countyExpenditureFacts),

      db
        .select({ count: sql<number>`count(*)` })
        .from(payees)
        .where(eq(payees.isConfidential, false)),

      db
        .select({ count: sql<number>`count(*)` })
        .from(payeeVendorMatches)
        .innerJoin(payees, eq(payeeVendorMatches.payeeId, payees.id))
        .where(
          and(
            eq(payees.isConfidential, false),
            inArray(payeeVendorMatches.reviewStatus, ['approved', 'auto-accepted']),
          ),
        ),

      db
        .select({
          jobName: ingestionRuns.jobName,
          sourceName: ingestionRuns.sourceName,
          status: ingestionRuns.status,
          rowsInserted: ingestionRuns.rowsInserted,
          startedAt: ingestionRuns.startedAt,
          finishedAt: ingestionRuns.finishedAt,
        })
        .from(ingestionRuns)
        .orderBy(desc(ingestionRuns.startedAt))
        .limit(5),
    ])

  const allYearsRow = paymentRollupRows.find((r) => r.scopeFiscalYear === ROLLUP_ALL_YEARS)
  const paymentFiscalYears = paymentRollupRows
    .filter((r) => r.scopeFiscalYear !== ROLLUP_ALL_YEARS)
    .map((r) => r.scopeFiscalYear)
  const paymentCount = Number(allYearsRow?.paymentCountAll ?? 0)
  const publicCount = Number(allYearsRow?.paymentCountPublic ?? 0)
  const confidentialCount = paymentCount - publicCount
  const paymentLatestLoad = allYearsRow?.updatedAt?.toISOString() ?? null
  const backfillActive =
    paymentCount > 0 && paymentCount < PAYMENTS_EXPORT_SUMMARY.source_row_count * BACKFILL_THRESHOLD

  const countyAgg = countyAggRows[0]
  const countyCount = Number(countyAgg?.totalCount ?? 0)
  const countyLatestLoad = countyAgg?.latestLoad ?? null
  const countyFiscalYears: number[] = countyAgg?.fiscalYears ?? []

  const payeeTotal = Number(payeeTotalRows[0]?.count ?? 0)
  const payeeMatched = Number(payeeMatchedRows[0]?.count ?? 0)
  const vendorMatchCoverage =
    payeeTotal > 0 ? Math.round((payeeMatched / payeeTotal) * 1000) / 10 : null

  return {
    generated_at: new Date().toISOString(),
    payments: {
      row_count: paymentCount,
      backfill_active: backfillActive,
      source_row_count: PAYMENTS_EXPORT_SUMMARY.source_row_count,
      fiscal_years: paymentFiscalYears,
      public_count: publicCount,
      confidential_count: confidentialCount,
      latest_source_loaded_at: paymentLatestLoad,
      note: 'Row counts are sourced from the pre-computed rollup table and reflect the most recently refreshed aggregate. The rollup is updated with each ingestion run.',
    },
    county_facts: {
      row_count: countyCount,
      fiscal_years: countyFiscalYears,
      latest_source_loaded_at: countyLatestLoad,
      note: 'County data is an annual aggregate layer, not a geocoded rollup of individual payment rows.',
    },
    vendor_matching: {
      public_payee_count: payeeTotal,
      matched_payee_count: payeeMatched,
      coverage_pct: vendorMatchCoverage,
      note: 'Vendor matches are approximate — payees are linked to vendors by normalized name because the public payment feed does not include stable vendor IDs.',
    },
    recent_ingestion_runs: latestIngestionRows.map((r) => ({
      job_name: r.jobName,
      source_name: r.sourceName,
      status: r.status,
      rows_inserted: r.rowsInserted,
      started_at: r.startedAt,
      finished_at: r.finishedAt,
    })),
  }
})
