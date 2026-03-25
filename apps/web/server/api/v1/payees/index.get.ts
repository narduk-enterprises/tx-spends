import { getValidatedQuery } from 'h3'
import { eq, desc, sql, like, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts, payees } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const payeeConditions = []
  if (query.q) {
    payeeConditions.push(
      like(payees.payeeNameNormalized, `%${query.q.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')}%`),
    )
  }
  if (!query.include_confidential) {
    payeeConditions.push(eq(payees.isConfidential, false))
  }

  const wherePayee = payeeConditions.length > 0 ? and(...payeeConditions) : undefined
  const paymentConditions = query.fiscal_year
    ? [eq(statePaymentFacts.fiscalYear, query.fiscal_year)]
    : []

  const list = await db
    .select({
      payee_id: payees.id,
      payee_name: payees.payeeNameRaw,
      is_confidential: payees.isConfidential,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(payees)
    .leftJoin(
      statePaymentFacts,
      and(eq(payees.id, statePaymentFacts.payeeId), ...paymentConditions),
    )
    .where(wherePayee)
    .groupBy(payees.id, payees.payeeNameRaw, payees.isConfidential)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: list.map((p) => ({
      ...p,
      amount: Number(p.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
