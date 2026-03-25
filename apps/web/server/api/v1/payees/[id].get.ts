import { getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { payees, payeeVendorMatches, vendorEnrichment } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')

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

  return {
    data: payee,
  }
})
