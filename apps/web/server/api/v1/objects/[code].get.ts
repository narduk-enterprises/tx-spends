import { getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { comptrollerObjects } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')

  if (!code) throw createError({ statusCode: 400, message: 'Missing object_code' })

  const [obj] = await db
    .select()
    .from(comptrollerObjects)
    .where(eq(comptrollerObjects.code, code))
    .limit(1)

  if (!obj) throw createError({ statusCode: 404, message: 'Object not found' })

  return {
    data: {
      object_code: obj.code,
      object_title: obj.title,
    },
  }
})
