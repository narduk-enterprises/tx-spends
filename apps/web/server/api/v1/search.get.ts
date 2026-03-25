import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { getValidatedQuery } from 'h3'
import { useAppDatabase } from '#server/utils/database'
import {
  agencies,
  comptrollerObjects,
  geographiesCounties,
  payeeVendorMatches,
  payees,
  paymentAgencyRollups,
  paymentCategoryRollups,
  paymentPayeeRollups,
} from '#server/database/schema'
import { formatCountyDisplayName } from '#server/utils/explorer'
import { getPaymentsBackfillStatus } from '#server/utils/payments-backfill'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  if (!query.q) {
    return {
      data: {
        agencies: [],
        payees: [],
        categories: [],
        objects: [],
        counties: [],
      },
    }
  }

  const normalizedQuery = query.q.trim()
  const normalizedTextQuery = normalizedQuery.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '').trim()
  const searchStr = `%${normalizedTextQuery}%`
  const rawSearch = `%${normalizedQuery}%`
  const numericCodeQuery = /^\d{2,}$/.test(normalizedQuery)

  if (!normalizedTextQuery && !numericCodeQuery) {
    return {
      data: {
        agencies: [],
        payees: [],
        categories: [],
        objects: [],
        counties: [],
      },
    }
  }

  const shouldSearchBroadText = normalizedTextQuery.length >= 2 && !numericCodeQuery
  const shouldSearchCounties = normalizedTextQuery.length >= 2 && !numericCodeQuery
  const paymentsBackfillPromise = getPaymentsBackfillStatus(db)
  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const agencyAmountColumn = query.include_confidential
    ? paymentAgencyRollups.totalSpendAll
    : paymentAgencyRollups.totalSpendPublic
  const payeeAmountColumn = query.include_confidential
    ? paymentPayeeRollups.totalAmountAll
    : paymentPayeeRollups.totalAmountPublic
  const payeeMatchedVendorExists = sql<boolean>`EXISTS (
    SELECT 1
    FROM ${payeeVendorMatches}
    WHERE ${payeeVendorMatches.payeeId} = ${paymentPayeeRollups.payeeId}
  )`
  const categoryAmountColumn = query.include_confidential
    ? paymentCategoryRollups.totalAmountAll
    : paymentCategoryRollups.totalAmountPublic
  const objectRelevanceSql = sql<number>`CASE
    WHEN ${comptrollerObjects.code} = ${normalizedQuery} THEN 0
    WHEN ${comptrollerObjects.code} LIKE ${`${normalizedQuery}%`} THEN 1
    WHEN upper(${comptrollerObjects.title}) LIKE ${`${normalizedTextQuery}%`} THEN 2
    WHEN ${comptrollerObjects.code} LIKE ${`%${normalizedQuery}%`} THEN 3
    WHEN upper(${comptrollerObjects.title}) LIKE ${searchStr} THEN 4
    ELSE 5
  END`

  const payeeConditions = [
    eq(paymentPayeeRollups.scopeFiscalYear, scopeFiscalYear),
    like(payees.payeeNameNormalized, searchStr),
  ]

  if (!query.include_confidential) {
    payeeConditions.push(eq(payees.isConfidential, false))
  }
  if (query.matched_vendor_only) {
    payeeConditions.push(payeeMatchedVendorExists)
  }

  const [paymentsBackfill, agencyList, payeeList, categoryList, objectList, countyList] =
    await Promise.all([
      paymentsBackfillPromise,
      shouldSearchBroadText
        ? db
            .select({
              id: agencies.id,
              name: agencies.agencyName,
              type: sql<string>`'agency'`,
            })
            .from(paymentAgencyRollups)
            .innerJoin(agencies, eq(paymentAgencyRollups.agencyId, agencies.id))
            .where(
              and(
                eq(paymentAgencyRollups.scopeFiscalYear, scopeFiscalYear),
                like(agencies.agencyNameNormalized, searchStr),
              ),
            )
            .orderBy(desc(agencyAmountColumn), asc(agencies.agencyName))
            .limit(5)
        : Promise.resolve([]),
      shouldSearchBroadText
        ? db
            .select({
              id: payees.id,
              name: payees.payeeNameRaw,
              type: sql<string>`'payee'`,
            })
            .from(paymentPayeeRollups)
            .innerJoin(payees, eq(paymentPayeeRollups.payeeId, payees.id))
            .where(and(...payeeConditions))
            .orderBy(desc(payeeAmountColumn), asc(payees.payeeNameRaw))
            .limit(5)
        : Promise.resolve([]),
      db
        .select({
          id: paymentCategoryRollups.categoryCode,
          name: paymentCategoryRollups.categoryTitle,
          type: sql<string>`'category'`,
        })
        .from(paymentCategoryRollups)
        .where(
          and(
            eq(paymentCategoryRollups.scopeFiscalYear, scopeFiscalYear),
            or(
              like(paymentCategoryRollups.categoryCode, rawSearch),
              like(sql`upper(${paymentCategoryRollups.categoryTitle})`, searchStr),
            ),
          ),
        )
        .orderBy(desc(categoryAmountColumn), asc(paymentCategoryRollups.categoryTitle))
        .limit(5),
      db
        .select({
          id: comptrollerObjects.code,
          name: sql<string>`${comptrollerObjects.code} || ' ' || ${comptrollerObjects.title}`,
          type: sql<string>`'object'`,
        })
        .from(comptrollerObjects)
        .where(
          numericCodeQuery
            ? like(comptrollerObjects.code, `${normalizedQuery}%`)
            : or(
                like(comptrollerObjects.code, rawSearch),
                like(sql`upper(${comptrollerObjects.title})`, searchStr),
              ),
        )
        .orderBy(asc(objectRelevanceSql), asc(comptrollerObjects.code))
        .limit(5),
      shouldSearchCounties
        ? db
            .select({
              id: geographiesCounties.id,
              name: geographiesCounties.countyName,
              type: sql<string>`'county'`,
            })
            .from(geographiesCounties)
            .where(like(geographiesCounties.countyName, rawSearch))
            .limit(5)
        : Promise.resolve([]),
    ])

  return {
    filters_applied: query,
    data: {
      agencies: agencyList,
      payees: payeeList,
      categories: categoryList,
      objects: objectList,
      counties: countyList.map((county) => ({
        ...county,
        name: formatCountyDisplayName(county.name, 'Unknown'),
      })),
    },
    meta: {
      payments_backfill_active: paymentsBackfill.active,
      payments_backfill: paymentsBackfill,
    },
  }
})
