export interface CountyMapMetric {
  county_id: string
  county_name: string | null
  amount: number
}

export interface CountyMapQuery {
  fiscal_year?: number | null
  q?: string | null
  agency_id?: string | null
  category_code?: string | null
}
