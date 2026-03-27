import { z } from 'zod'
import { globalQuerySchema } from '#server/utils/query'

export const analysisDatasetSchema = z.enum(['payments', 'counties'])
export const analysisModeSchema = z.enum(['trends', 'concentration', 'outliers', 'relationships'])
export const analysisSubjectSchema = z.enum(['system', 'agency', 'payee', 'county'])
export const analysisBreakdownSchema = z.enum([
  'agency',
  'payee',
  'category',
  'object',
  'county',
  'expenditure_type',
])
export const analysisRelationshipSchema = z.enum([
  'agency_payee',
  'agency_category',
  'payee_category',
  'agency_object',
])

export const analysisQuerySchema = globalQuerySchema
  .extend({
    dataset: analysisDatasetSchema.default('payments'),
    mode: analysisModeSchema.optional(),
    subject: analysisSubjectSchema.default('system'),
    breakdown: analysisBreakdownSchema.optional(),
    relationship: analysisRelationshipSchema.default('agency_payee'),
    compare_limit: z.coerce.number().min(1).max(5).default(3),
    min_parent_amount: z.coerce.number().min(0).default(1_000_000),
    min_change_amount: z.coerce.number().min(0).default(1_000_000),
    min_change_pct: z.coerce.number().min(0).default(25),
  })
  .superRefine((value, context) => {
    if (value.dataset === 'counties' && value.subject === 'payee') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: 'County analysis does not support payee subjects.',
      })
    }

    if (value.dataset === 'counties' && value.payee_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payee_id'],
        message: 'County analysis cannot filter by payee_id.',
      })
    }

    if (value.dataset === 'counties' && value.object_code) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['object_code'],
        message: 'County analysis cannot filter by object_code.',
      })
    }

    if (value.dataset === 'payments' && value.subject === 'county') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: 'Payment analysis cannot use county as a transaction-level subject.',
      })
    }
  })

export type AnalysisDataset = z.infer<typeof analysisDatasetSchema>
export type AnalysisMode = z.infer<typeof analysisModeSchema>
export type AnalysisSubject = z.infer<typeof analysisSubjectSchema>
export type AnalysisBreakdown = z.infer<typeof analysisBreakdownSchema>
export type AnalysisRelationship = z.infer<typeof analysisRelationshipSchema>
export type AnalysisQuery = z.infer<typeof analysisQuerySchema>
