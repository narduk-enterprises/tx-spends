import { getValidatedQuery } from 'h3'
import { eq, desc, asc, sql, and, gte, lte } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts, agencies, payees, comptrollerObjects } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  if (query.county_id) {
    throw createError({
      statusCode: 400,
      data: {
        code: 'UNSUPPORTED_COMBINATION',
        message: 'county_id is not supported on transaction endpoints',
      },
    })
  }

  const conditions = []
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  if (query.agency_id) conditions.push(eq(statePaymentFacts.agencyId, query.agency_id))
  if (query.payee_id) conditions.push(eq(statePaymentFacts.payeeId, query.payee_id))
  if (query.object_code)
    conditions.push(eq(statePaymentFacts.comptrollerObjectCode, query.object_code))

  if (query.date_start) conditions.push(gte(statePaymentFacts.paymentDate, query.date_start))
  if (query.date_end) conditions.push(lte(statePaymentFacts.paymentDate, query.date_end))

  // NOTE: drizzle-orm string manipulation for numerics requires sql or cast
  if (query.min_amount) conditions.push(sql`${statePaymentFacts.amount} >= ${query.min_amount}`)
  if (query.max_amount) conditions.push(sql`${statePaymentFacts.amount} <= ${query.max_amount}`)

  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const orderDirection = query.order === 'asc' ? asc : desc
  const sortCol =
    query.sort === 'payment_date' ? statePaymentFacts.paymentDate : statePaymentFacts.amount

  const list = await db
    .select({
      transaction_id: statePaymentFacts.sourceRowHash,
      payment_date: statePaymentFacts.paymentDate,
      fiscal_year: statePaymentFacts.fiscalYear,
      agency_id: statePaymentFacts.agencyId,
      agency_name: agencies.agencyName,
      payee_id: statePaymentFacts.payeeId,
      payee_name: payees.payeeNameRaw,
      amount: statePaymentFacts.amount,
      object_category_raw: statePaymentFacts.objectCategoryRaw,
      object_code: statePaymentFacts.comptrollerObjectCode,
      object_title: comptrollerObjects.title,
      appropriated_fund_raw: statePaymentFacts.appropriatedFundRaw,
      appropriation_number: statePaymentFacts.appropriationNumber,
      appropriation_year: statePaymentFacts.appropriationYear,
      is_confidential: statePaymentFacts.isConfidential,
    })
    .from(statePaymentFacts)
    .leftJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
    .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
    .leftJoin(
      comptrollerObjects,
      eq(statePaymentFacts.comptrollerObjectCode, comptrollerObjects.code),
    )
    .where(whereClause)
    .orderBy(orderDirection(sortCol))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: list.map((t: any) => {
      // 10.7 Confidential obfuscation
      if (t.is_confidential && !query.include_confidential) {
        t.payee_id = null
        t.payee_name = 'CONFIDENTIAL'
      }
      return {
        ...t,
        amount: Number(t.amount || 0),
      }
    }),
    meta: { currency: 'USD' },
  }
})
