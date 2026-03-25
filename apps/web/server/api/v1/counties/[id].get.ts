import { getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { geographiesCounties } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing county_id' })

  const [county] = await db
    .select()
    .from(geographiesCounties)
    .where(eq(geographiesCounties.id, id))
    .limit(1)

  if (!county) throw createError({ statusCode: 404, message: 'County not found' })

  return {
    data: {
      county_id: county.id,
      county_name: county.countyName,
      fips_code: county.fipsCode,
    },
  }
})
