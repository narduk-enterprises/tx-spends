import { getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { formatAgencyDisplayName } from '#server/utils/explorer'
import { statePaymentFacts, agencies, payees, comptrollerObjects } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const transactionId = getRouterParam(event, 'transactionId')

  if (!transactionId) throw createError({ statusCode: 400, message: 'Missing transaction_id' })

  const [t] = await db
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
    .where(eq(statePaymentFacts.sourceRowHash, transactionId))
    .limit(1)

  if (!t) throw createError({ statusCode: 404, message: 'Transaction not found' })

  return {
    data: {
      ...t,
      agency_name: formatAgencyDisplayName(t.agency_name),
      payee_id: t.is_confidential ? null : t.payee_id,
      payee_name: t.is_confidential ? 'CONFIDENTIAL' : t.payee_name,
      amount: Number(t.amount || 0),
    },
  }
})
