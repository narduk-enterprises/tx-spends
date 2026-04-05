import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  comptrollerObjectCategoryMap,
  comptrollerObjects,
  expenditureCategories,
  paymentObjectRollups,
} from '#server/database/schema'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing object_code' })
  }

  const [obj] = await db
    .select({
      code: comptrollerObjects.code,
      title: comptrollerObjects.title,
      objectGroup: comptrollerObjects.objectGroup,
      expenditureCategoryTitle: expenditureCategories.title,
      expenditureCategoryCode: expenditureCategories.code,
    })
    .from(comptrollerObjects)
    .leftJoin(
      comptrollerObjectCategoryMap,
      eq(comptrollerObjects.code, comptrollerObjectCategoryMap.comptrollerObjectCode),
    )
    .leftJoin(
      expenditureCategories,
      eq(comptrollerObjectCategoryMap.expenditureCategoryCode, expenditureCategories.code),
    )
    .where(eq(comptrollerObjects.code, code))
    .limit(1)

  if (!obj) {
    throw createError({ statusCode: 404, message: 'Object not found' })
  }

  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const totalAmountColumn = query.include_confidential
    ? paymentObjectRollups.totalAmountAll
    : paymentObjectRollups.totalAmountPublic

  const [summary] = await db
    .select({
      total_spend: totalAmountColumn,
    })
    .from(paymentObjectRollups)
    .where(
      and(
        eq(paymentObjectRollups.scopeFiscalYear, scopeFiscalYear),
        eq(paymentObjectRollups.objectCode, code),
      ),
    )
    .limit(1)

  return {
    data: {
      object_code: obj.code,
      object_title: obj.title,
      object_group: obj.objectGroup,
      category_title: obj.expenditureCategoryTitle,
      category_code: obj.expenditureCategoryCode,
      total_spend: Number(summary?.total_spend || 0),
    },
  }
})
