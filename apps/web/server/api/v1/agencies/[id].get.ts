import { getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { agencies } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')

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

  return {
    data: {
      agency_id: agency.id,
      agency_name: agency.agencyName,
      agency_name_normalized: agency.agencyNameNormalized,
    },
  }
})
