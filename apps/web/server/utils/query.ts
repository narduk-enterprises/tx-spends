import { z } from 'zod'

export const globalQuerySchema = z.object({
  fiscal_year: z.coerce.number().optional(),
  fiscal_year_start: z.coerce.number().optional(),
  fiscal_year_end: z.coerce.number().optional(),
  agency_id: z.string().uuid().optional(),
  payee_id: z.string().uuid().optional(),
  category_code: z.string().optional(),
  object_code: z.string().optional(),
  county_id: z.string().uuid().optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  include_confidential: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  matched_vendor_only: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type GlobalQuery = z.infer<typeof globalQuerySchema>
