import { getRouterParam, getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  agencies,
  payeeVendorMatches,
  payees,
  paymentPayeeRollups,
  statePaymentFacts,
  vendorEnrichment,
} from '#server/database/schema'
import { formatAgencyDisplayName } from '#server/utils/explorer'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const payeeId = getRouterParam(event, 'payeeId')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!payeeId) {
    throw createError({ statusCode: 400, message: 'Missing payee_id' })
  }

  const [payee] = await db
    .select({
      payee_id: payees.id,
      payee_name: payees.payeeNameRaw,
      payee_name_normalized: payees.payeeNameNormalized,
      is_confidential: payees.isConfidential,
      vendor_id: vendorEnrichment.id,
      vendor_name: vendorEnrichment.vendorNameRaw,
      hub_status: vendorEnrichment.hubStatus,
      city: vendorEnrichment.city,
      state: vendorEnrichment.state,
      zip: vendorEnrichment.zip,
      match_confidence: payeeVendorMatches.matchConfidence,
      match_method: payeeVendorMatches.matchMethod,
    })
    .from(payees)
    .leftJoin(payeeVendorMatches, eq(payees.id, payeeVendorMatches.payeeId))
    .leftJoin(vendorEnrichment, eq(payeeVendorMatches.vendorEnrichmentId, vendorEnrichment.id))
    .where(eq(payees.id, payeeId))
    .limit(1)

  if (!payee) {
    throw createError({ statusCode: 404, message: 'Payee not found' })
  }

  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const totalAmountColumn = query.include_confidential
    ? paymentPayeeRollups.totalAmountAll
    : paymentPayeeRollups.totalAmountPublic
  const agencyCountColumn = query.include_confidential
    ? paymentPayeeRollups.agencyCountAll
    : paymentPayeeRollups.agencyCountPublic

  const [summary] = await db
    .select({
      total_received: totalAmountColumn,
      agency_count: agencyCountColumn,
    })
    .from(paymentPayeeRollups)
    .where(
      and(
        eq(paymentPayeeRollups.scopeFiscalYear, scopeFiscalYear),
        eq(paymentPayeeRollups.payeeId, payeeId),
      ),
    )
    .limit(1)

  const conditions = [eq(statePaymentFacts.payeeId, payeeId)]
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }
  const whereClause = and(...conditions)

  const [largestAgency] = await db
    .select({
      agency_id: statePaymentFacts.agencyId,
      agency_name: agencies.agencyName,
      amount: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
    })
    .from(statePaymentFacts)
    .leftJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
    .where(whereClause)
    .groupBy(statePaymentFacts.agencyId, agencies.agencyName)
    .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`))
    .limit(1)

  return {
    data: {
      ...payee,
      total_received: Number(summary?.total_received || 0),
      agency_count: Number(summary?.agency_count || 0),
      largest_agency: largestAgency
        ? {
            agency_id: largestAgency.agency_id,
            agency_name: formatAgencyDisplayName(largestAgency.agency_name),
            amount: Number(largestAgency.amount || 0),
          }
        : null,
    },
  }
})
