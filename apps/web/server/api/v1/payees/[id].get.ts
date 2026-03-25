import { getRouterParam, getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  agencies,
  payeeVendorMatches,
  payees,
  statePaymentFacts,
  vendorEnrichment,
} from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing payee_id' })

  const [payee] = await db
    .select({
      payee_id: payees.id,
      payee_name: payees.payeeNameRaw,
      payee_name_normalized: payees.payeeNameNormalized,
      is_confidential: payees.isConfidential,
      // Vendor enrichment
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
    .where(eq(payees.id, id))
    .limit(1)

  if (!payee) throw createError({ statusCode: 404, message: 'Payee not found' })

  const conditions = [eq(statePaymentFacts.payeeId, id)]
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  const whereClause = and(...conditions)

  const [summary] = await db
    .select({
      total_received: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
      agency_count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.agencyId})`,
    })
    .from(statePaymentFacts)
    .where(whereClause)

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
            agency_name: largestAgency.agency_name,
            amount: Number(largestAgency.amount || 0),
          }
        : null,
    },
  }
})
