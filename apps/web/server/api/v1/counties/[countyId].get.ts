import { getRouterParam, getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  countyCategoryCodeSql,
  countyCategoryTitleSql,
  formatAgencyDisplayName,
  formatCategoryDisplayName,
  formatCountyDisplayName,
} from '#server/utils/explorer'
import { agencies, countyExpenditureFacts, geographiesCounties } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const countyId = getRouterParam(event, 'countyId')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!countyId) throw createError({ statusCode: 400, message: 'Missing county_id' })

  const [county] = await db
    .select()
    .from(geographiesCounties)
    .where(eq(geographiesCounties.id, countyId))
    .limit(1)

  if (!county) throw createError({ statusCode: 404, message: 'County not found' })

  const conditions = [eq(countyExpenditureFacts.countyId, countyId)]
  if (query.fiscal_year) {
    conditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  }
  const whereClause = and(...conditions)
  const countyCategoryCode = countyCategoryCodeSql(countyExpenditureFacts.expenditureTypeRaw)
  const countyCategoryTitle = countyCategoryTitleSql(countyExpenditureFacts.expenditureTypeRaw)

  const [summary] = await db
    .select({
      total_state_spend_landed: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
    })
    .from(countyExpenditureFacts)
    .where(whereClause)

  const [topAgency] = await db
    .select({
      agency_id: countyExpenditureFacts.agencyId,
      agency_name: agencies.agencyName,
      amount: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(agencies, eq(countyExpenditureFacts.agencyId, agencies.id))
    .where(whereClause)
    .groupBy(countyExpenditureFacts.agencyId, agencies.agencyName)
    .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))
    .limit(1)

  const [topExpenditureType] = await db
    .select({
      category_code: countyCategoryCode,
      category_title: countyCategoryTitle,
      amount: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
    })
    .from(countyExpenditureFacts)
    .where(whereClause)
    .groupBy(countyCategoryCode, countyCategoryTitle)
    .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))
    .limit(1)

  const rankedCounties = await db
    .select({
      county_id: countyExpenditureFacts.countyId,
      amount: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
    })
    .from(countyExpenditureFacts)
    .where(query.fiscal_year ? eq(countyExpenditureFacts.fiscalYear, query.fiscal_year) : undefined)
    .groupBy(countyExpenditureFacts.countyId)
    .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))

  const statewideRank =
    rankedCounties.findIndex((entry) => entry.county_id === countyId) >= 0
      ? rankedCounties.findIndex((entry) => entry.county_id === countyId) + 1
      : null

  const availableFiscalYears = await db
    .select({
      fiscal_year: countyExpenditureFacts.fiscalYear,
    })
    .from(countyExpenditureFacts)
    .where(eq(countyExpenditureFacts.countyId, countyId))
    .groupBy(countyExpenditureFacts.fiscalYear)
    .orderBy(desc(countyExpenditureFacts.fiscalYear))

  return {
    data: {
      county_id: county.id,
      county_name: formatCountyDisplayName(county.countyName, 'Unknown'),
      fips_code: county.fipsCode,
      total_state_spend_landed: Number(summary?.total_state_spend_landed || 0),
      top_agency: topAgency
        ? {
            agency_id: topAgency.agency_id,
            agency_name: formatAgencyDisplayName(topAgency.agency_name),
            amount: Number(topAgency.amount || 0),
          }
        : null,
      top_expenditure_type: topExpenditureType
        ? {
            category_code: topExpenditureType.category_code,
            category_title: formatCategoryDisplayName(
              topExpenditureType.category_title,
              'Uncategorized',
            ),
            amount: Number(topExpenditureType.amount || 0),
          }
        : null,
      statewide_rank: statewideRank,
      available_fiscal_years: availableFiscalYears
        .map((entry) => entry.fiscal_year)
        .filter((value): value is number => Number.isFinite(value)),
    },
  }
})
