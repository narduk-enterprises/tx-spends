import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { normalizeSearchTerm, paymentCategoryCodeSql } from '#server/utils/explorer'
import { isPaymentsBackfillActive } from '#server/utils/payments-backfill'
import { agencies, comptrollerObjects, payees, statePaymentFacts } from '#server/database/schema'
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

  if (await isPaymentsBackfillActive(db)) {
    return {
      filters_applied: query,
      data: [],
      meta: {
        currency: 'USD',
        limit: query.limit,
        offset: query.offset,
        returned: 0,
        total: 0,
        payments_backfill_active: true,
      },
    }
  }

  const conditions = []
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  if (query.agency_id) conditions.push(eq(statePaymentFacts.agencyId, query.agency_id))
  if (query.payee_id) conditions.push(eq(statePaymentFacts.payeeId, query.payee_id))
  if (query.object_code)
    conditions.push(eq(statePaymentFacts.comptrollerObjectCode, query.object_code))
  if (query.category_code) {
    const categoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
    conditions.push(sql`${categoryCode} = ${query.category_code}`)
  }

  if (query.date_start) conditions.push(gte(statePaymentFacts.paymentDate, query.date_start))
  if (query.date_end) conditions.push(lte(statePaymentFacts.paymentDate, query.date_end))

  if (query.min_amount) conditions.push(sql`${statePaymentFacts.amount} >= ${query.min_amount}`)
  if (query.max_amount) conditions.push(sql`${statePaymentFacts.amount} <= ${query.max_amount}`)
  if (query.q) {
    const normalizedSearch = `%${normalizeSearchTerm(query.q)}%`
    conditions.push(
      or(
        like(agencies.agencyNameNormalized, normalizedSearch),
        like(payees.payeeNameNormalized, normalizedSearch),
      )!,
    )
  }

  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const orderDirection = query.order === 'asc' ? asc : desc
  const sortCol =
    query.sort === 'payment_date'
      ? statePaymentFacts.paymentDate
      : query.sort === 'agency'
        ? agencies.agencyName
        : query.sort === 'payee'
          ? payees.payeeNameRaw
          : statePaymentFacts.amount

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

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${statePaymentFacts.sourceRowHash})`,
    })
    .from(statePaymentFacts)
    .leftJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
    .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((transaction) => {
      const isConfidential = Boolean(transaction.is_confidential)
      return {
        ...transaction,
        payee_id: isConfidential ? null : transaction.payee_id,
        payee_name: isConfidential ? 'CONFIDENTIAL' : transaction.payee_name,
        amount: Number(transaction.amount || 0),
      }
    }),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
      payments_backfill_active: false,
    },
  }
})
