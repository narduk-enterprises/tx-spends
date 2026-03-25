import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { getValidatedQuery } from 'h3'
import { useAppDatabase } from '#server/utils/database'
import {
  agencies,
  comptrollerObjects,
  fiscalYears,
  geographiesCounties,
  payees,
  statePaymentFacts,
} from '#server/database/schema'
import {
  formatCountyDisplayName,
  paymentCategoryCodeSql,
  paymentCategoryTitleSql,
} from '#server/utils/explorer'
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
  const searchStr = `%${normalizedQuery.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')}%`
  const rawSearch = `%${normalizedQuery}%`
  const categoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
  const categoryTitle = paymentCategoryTitleSql(statePaymentFacts.objectCategoryRaw)
  const [paymentsBackfillState] = await db
    .select({
      active: sql<boolean>`exists(
        select 1
        from pg_stat_activity
        where state = 'active'
          and query ilike 'INSERT INTO state_payment_facts%'
      )`.as('active'),
    })
    .from(fiscalYears)
    .limit(1)

  const paymentsBackfillActive = Boolean(paymentsBackfillState?.active)
  const objectRelevanceSql = sql<number>`CASE
    WHEN ${comptrollerObjects.code} = ${normalizedQuery} THEN 0
    WHEN ${comptrollerObjects.code} LIKE ${`${normalizedQuery}%`} THEN 1
    WHEN ${comptrollerObjects.title} LIKE ${`${normalizedQuery}%`} THEN 2
    WHEN ${comptrollerObjects.code} LIKE ${`%${normalizedQuery}%`} THEN 3
    WHEN ${comptrollerObjects.title} LIKE ${`%${normalizedQuery}%`} THEN 4
    ELSE 5
  END`

  const agencyList = paymentsBackfillActive
    ? await db
        .select({
          id: agencies.id,
          name: agencies.agencyName,
          type: sql<string>`'agency'`,
        })
        .from(agencies)
        .where(like(agencies.agencyNameNormalized, searchStr))
        .orderBy(asc(agencies.agencyName))
        .limit(5)
    : await db
        .select({
          id: agencies.id,
          name: agencies.agencyName,
          type: sql<string>`'agency'`,
        })
        .from(statePaymentFacts)
        .innerJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
        .where(
          and(
            eq(statePaymentFacts.isConfidential, false),
            like(agencies.agencyNameNormalized, searchStr),
          ),
        )
        .groupBy(agencies.id, agencies.agencyName)
        .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`), asc(agencies.agencyName))
        .limit(5)

  const payeeList = paymentsBackfillActive
    ? await db
        .select({
          id: payees.id,
          name: payees.payeeNameRaw,
          type: sql<string>`'payee'`,
        })
        .from(payees)
        .where(and(eq(payees.isConfidential, false), like(payees.payeeNameNormalized, searchStr)))
        .orderBy(asc(payees.payeeNameRaw))
        .limit(5)
    : await db
        .select({
          id: payees.id,
          name: payees.payeeNameRaw,
          type: sql<string>`'payee'`,
        })
        .from(statePaymentFacts)
        .innerJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
        .where(
          and(
            eq(statePaymentFacts.isConfidential, false),
            like(payees.payeeNameNormalized, searchStr),
          ),
        )
        .groupBy(payees.id, payees.payeeNameRaw)
        .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`), asc(payees.payeeNameRaw))
        .limit(5)

  const categoryList = paymentsBackfillActive
    ? []
    : await db
        .select({
          id: categoryCode,
          name: categoryTitle,
          type: sql<string>`'category'`,
        })
        .from(statePaymentFacts)
        .where(
          and(
            eq(statePaymentFacts.isConfidential, false),
            or(like(categoryCode, rawSearch), like(categoryTitle, rawSearch)),
          ),
        )
        .groupBy(categoryCode, categoryTitle)
        .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`), asc(categoryTitle))
        .limit(5)

  const objectList = await db
    .select({
      id: comptrollerObjects.code,
      name: sql<string>`${comptrollerObjects.code} || ' ' || ${comptrollerObjects.title}`,
      type: sql<string>`'object'`,
    })
    .from(comptrollerObjects)
    .where(or(like(comptrollerObjects.code, rawSearch), like(comptrollerObjects.title, rawSearch)))
    .orderBy(asc(objectRelevanceSql), asc(comptrollerObjects.code))
    .limit(5)

  const countyList = await db
    .select({
      id: geographiesCounties.id,
      name: geographiesCounties.countyName,
      type: sql<string>`'county'`,
    })
    .from(geographiesCounties)
    .where(like(geographiesCounties.countyName, rawSearch))
    .limit(5)

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
      payments_backfill_active: paymentsBackfillActive,
    },
  }
})
