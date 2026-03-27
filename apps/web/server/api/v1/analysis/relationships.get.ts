import { getValidatedQuery } from 'h3'
import { useAppDatabase } from '#server/utils/database'
import { getRelationshipAnalysis } from '#server/utils/analysis'
import { analysisQuerySchema } from '#server/utils/analysis-query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const query = await getValidatedQuery(event, analysisQuerySchema.parse)
  return getRelationshipAnalysis(db, query)
})
