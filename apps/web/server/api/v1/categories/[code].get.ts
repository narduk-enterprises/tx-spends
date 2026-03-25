import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentCategoryRollups } from '#server/database/schema'
import { formatCategoryDisplayName } from '#server/utils/explorer'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing category_code' })
  }

  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const totalAmountColumn = query.include_confidential
    ? paymentCategoryRollups.totalAmountAll
    : paymentCategoryRollups.totalAmountPublic
  const agencyCountColumn = query.include_confidential
    ? paymentCategoryRollups.agencyCountAll
    : paymentCategoryRollups.agencyCountPublic
  const payeeCountColumn = query.include_confidential
    ? paymentCategoryRollups.payeeCountAll
    : paymentCategoryRollups.payeeCountPublic

  const [summary] = await db
    .select({
      category_code: paymentCategoryRollups.categoryCode,
      category_title: paymentCategoryRollups.categoryTitle,
      total_spend: totalAmountColumn,
      agency_count: agencyCountColumn,
      payee_count: payeeCountColumn,
    })
    .from(paymentCategoryRollups)
    .where(
      and(
        eq(paymentCategoryRollups.scopeFiscalYear, scopeFiscalYear),
        eq(paymentCategoryRollups.categoryCode, code),
      ),
    )
    .limit(1)

  if (!summary) {
    throw createError({ statusCode: 404, message: 'Category not found' })
  }

  return {
    data: {
      category_code: summary.category_code,
      category_title: formatCategoryDisplayName(summary.category_title, 'Uncategorized'),
      total_spend: Number(summary.total_spend || 0),
      agency_count: Number(summary.agency_count || 0),
      payee_count: Number(summary.payee_count || 0),
    },
  }
})
