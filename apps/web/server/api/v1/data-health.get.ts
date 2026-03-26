import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { PAYMENTS_EXPORT_SUMMARY } from '#server/utils/payments-backfill'
import {
  countyExpenditureFacts,
  ingestionRuns,
  payeeVendorMatches,
  payees,
  statePaymentFacts,
} from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)

  const [
    paymentAggRows,
    countyAggRows,
    payeeTotalRows,
    payeeMatchedRows,
    latestIngestionRows,
  ] = await Promise.all([
    db
      .select({
        totalCount: sql<number>`count(*)`,
        publicCount: sql<number>`count(*) filter (where ${statePaymentFacts.isConfidential} = false)`,
        confidentialCount: sql<number>`count(*) filter (where ${statePaymentFacts.isConfidential} = true)`,
        latestLoad: sql<string | null>`MAX(${statePaymentFacts.sourceLoadedAt})`,
        fiscalYears: sql<number[]>`array_agg(DISTINCT ${statePaymentFacts.fiscalYear} ORDER BY ${statePaymentFacts.fiscalYear})`,
      })
      .from(statePaymentFacts),

    db
      .select({
        totalCount: sql<number>`count(*)`,
        latestLoad: sql<string | null>`MAX(${countyExpenditureFacts.sourceLoadedAt})`,
        fiscalYears: sql<number[]>`array_agg(DISTINCT ${countyExpenditureFacts.fiscalYear} ORDER BY ${countyExpenditureFacts.fiscalYear})`,
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

  const paymentAgg = paymentAggRows[0]
  const paymentCount = Number(paymentAgg?.totalCount ?? 0)
  const publicCount = Number(paymentAgg?.publicCount ?? 0)
  const confidentialCount = Number(paymentAgg?.confidentialCount ?? 0)
  const paymentLatestLoad = paymentAgg?.latestLoad ?? null
  const paymentFiscalYears: number[] = paymentAgg?.fiscalYears ?? []
  const backfillActive =
    paymentCount > 0 && paymentCount < PAYMENTS_EXPORT_SUMMARY.source_row_count * 0.995

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
      note: 'Row counts reflect the current state of the payment fact table and may be incomplete while a backfill is active.',
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
