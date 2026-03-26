import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { getPaymentsBackfillStatus } from '#server/utils/payments-backfill'
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
    backfillStatus,
    paymentFiscalYearsRows,
    paymentConfidentialRows,
    paymentLatestLoadRows,
    countyCountRows,
    countyFiscalYearsRows,
    countyLatestLoadRows,
    payeeTotalRows,
    payeeMatchedRows,
    latestIngestionRows,
  ] = await Promise.all([
    getPaymentsBackfillStatus(db),

    db
      .select({ fiscalYear: statePaymentFacts.fiscalYear })
      .from(statePaymentFacts)
      .groupBy(statePaymentFacts.fiscalYear)
      .orderBy(statePaymentFacts.fiscalYear),

    db
      .select({
        publicCount: sql<number>`count(*) filter (where ${statePaymentFacts.isConfidential} = false)`,
        confidentialCount: sql<number>`count(*) filter (where ${statePaymentFacts.isConfidential} = true)`,
      })
      .from(statePaymentFacts),

    db
      .select({ latestLoad: sql<string | null>`MAX(${statePaymentFacts.sourceLoadedAt})` })
      .from(statePaymentFacts),

    db
      .select({ count: sql<number>`count(*)` })
      .from(countyExpenditureFacts),

    db
      .select({ fiscalYear: countyExpenditureFacts.fiscalYear })
      .from(countyExpenditureFacts)
      .groupBy(countyExpenditureFacts.fiscalYear)
      .orderBy(countyExpenditureFacts.fiscalYear),

    db
      .select({ latestLoad: sql<string | null>`MAX(${countyExpenditureFacts.sourceLoadedAt})` })
      .from(countyExpenditureFacts),

    db
      .select({ count: sql<number>`count(*)` })
      .from(payees)
      .where(eq(payees.isConfidential, false)),

    db
      .select({ count: sql<number>`count(distinct ${payeeVendorMatches.payeeId})` })
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

  const paymentCount = backfillStatus.row_count
  const paymentFiscalYears = paymentFiscalYearsRows.map((r) => r.fiscalYear)
  const publicCount = Number(paymentConfidentialRows[0]?.publicCount ?? 0)
  const confidentialCount = Number(paymentConfidentialRows[0]?.confidentialCount ?? 0)
  const paymentLatestLoad = paymentLatestLoadRows[0]?.latestLoad ?? null

  const countyCount = Number(countyCountRows[0]?.count ?? 0)
  const countyFiscalYears = countyFiscalYearsRows.map((r) => r.fiscalYear)
  const countyLatestLoad = countyLatestLoadRows[0]?.latestLoad ?? null

  const payeeTotal = Number(payeeTotalRows[0]?.count ?? 0)
  const payeeMatched = Number(payeeMatchedRows[0]?.count ?? 0)
  const vendorMatchCoverage =
    payeeTotal > 0 ? Math.round((payeeMatched / payeeTotal) * 1000) / 10 : null

  return {
    generated_at: new Date().toISOString(),
    payments: {
      row_count: paymentCount,
      backfill_active: backfillStatus.active,
      source_row_count: backfillStatus.source_row_count,
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
