import { getRouterParam, getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { agencies, paymentAgencyRollups } from '#server/database/schema'
import { formatAgencyDisplayName } from '#server/utils/explorer'
import { getRollupScopeFiscalYear, ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Missing agency_id',
    })
  }

  const [agency] = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1)

  if (!agency) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Agency not found',
    })
  }

  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const totalSpendColumn = query.include_confidential
    ? paymentAgencyRollups.totalSpendAll
    : paymentAgencyRollups.totalSpendPublic
  const paymentCountColumn = query.include_confidential
    ? paymentAgencyRollups.paymentCountAll
    : paymentAgencyRollups.paymentCountPublic
  const distinctPayeeCountColumn = query.include_confidential
    ? paymentAgencyRollups.distinctPayeeCountAll
    : paymentAgencyRollups.distinctPayeeCountPublic

  const [summary] = await db
    .select({
      total_spend: totalSpendColumn,
      payment_count: paymentCountColumn,
      distinct_payee_count: distinctPayeeCountColumn,
    })
    .from(paymentAgencyRollups)
    .where(
      and(
        eq(paymentAgencyRollups.scopeFiscalYear, scopeFiscalYear),
        eq(paymentAgencyRollups.agencyId, id),
      ),
    )
    .limit(1)

  const trendAmountColumn = query.include_confidential
    ? paymentAgencyRollups.totalSpendAll
    : paymentAgencyRollups.totalSpendPublic
  const trendRows = await db
    .select({
      fiscal_year: paymentAgencyRollups.scopeFiscalYear,
      amount: trendAmountColumn,
    })
    .from(paymentAgencyRollups)
    .where(
      and(
        eq(paymentAgencyRollups.agencyId, id),
        sql`${paymentAgencyRollups.scopeFiscalYear} <> ${ROLLUP_ALL_YEARS}`,
      ),
    )
    .orderBy(desc(paymentAgencyRollups.scopeFiscalYear))
    .limit(2)

  const currentAmount = Number(trendRows[0]?.amount || 0)
  const previousAmount = Number(trendRows[1]?.amount || 0)
  const yoyChangePct =
    previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : null

  return {
    data: {
      agency_id: agency.id,
      agency_code: agency.agencyCode,
      agency_name: formatAgencyDisplayName(agency.agencyName),
      agency_name_normalized: agency.agencyNameNormalized,
      total_spend: Number(summary?.total_spend || 0),
      payment_count: Number(summary?.payment_count || 0),
      distinct_payee_count: Number(summary?.distinct_payee_count || 0),
      top_payee: null,
      top_object: null,
      yoy_change_pct: yoyChangePct,
    },
  }
})
