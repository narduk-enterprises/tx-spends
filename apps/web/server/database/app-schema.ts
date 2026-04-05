import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  numeric,
  index,
  uniqueIndex,
  primaryKey,
  unique,
  serial,
  jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
// export * from './auth-bridge-schema'
// ========== DIMENSIONS ==========

export const fiscalYears = pgTable('fiscal_years', {
  fiscalYear: integer('fiscal_year').primaryKey(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  label: text('label').notNull(),
})

export const agencies = pgTable(
  'agencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyCode: text('agency_code'),
    agencyName: text('agency_name').notNull(),
    agencyNameNormalized: text('agency_name_normalized').notNull().unique(),
    sourceSystem: text('source_system').notNull().default('texas_comptroller'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_agencies_name').on(table.agencyName),
    index('idx_agencies_normalized').on(table.agencyNameNormalized),
  ],
)

export const payees = pgTable(
  'payees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    payeeNameRaw: text('payee_name_raw').notNull(),
    payeeNameNormalized: text('payee_name_normalized').notNull(),
    isConfidential: boolean('is_confidential').default(false).notNull(),
    entityType: text('entity_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('payees_normalized_confidential_uq').on(table.payeeNameNormalized, table.isConfidential),
    index('idx_payees_normalized').on(table.payeeNameNormalized),
  ],
)

export const geographiesCounties = pgTable(
  'geographies_counties',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateCode: text('state_code').notNull().default('TX'),
    countyName: text('county_name').notNull(),
    countyNameNormalized: text('county_name_normalized').notNull(),
    fipsCode: text('fips_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('counties_state_name_uq').on(table.stateCode, table.countyNameNormalized)],
)

export const comptrollerObjects = pgTable('comptroller_objects', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  objectGroup: text('object_group'),
  isExpenditure: boolean('is_expenditure').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const expenditureCategories = pgTable('expenditure_categories', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  displayOrder: integer('display_order'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const comptrollerObjectCategoryMap = pgTable(
  'comptroller_object_category_map',
  {
    comptrollerObjectCode: text('comptroller_object_code')
      .notNull()
      .references(() => comptrollerObjects.code),
    expenditureCategoryCode: text('expenditure_category_code')
      .notNull()
      .references(() => expenditureCategories.code),
    mappingSource: text('mapping_source').notNull(),
    isInferred: boolean('is_inferred').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.comptrollerObjectCode, table.expenditureCategoryCode] }),
  ],
)

export const vendorEnrichment = pgTable(
  'vendor_enrichment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorNameRaw: text('vendor_name_raw').notNull(),
    vendorNameNormalized: text('vendor_name_normalized').notNull(),
    cmblVendorNo: text('cmbl_vendor_no'),
    webVid: text('web_vid'),
    hubStatus: text('hub_status'),
    smallBusinessFlag: boolean('small_business_flag'),
    sdvFlag: boolean('sdv_flag'),
    city: text('city'),
    county: text('county'),
    state: text('state'),
    zip: text('zip'),
    email: text('email'),
    phone: text('phone'),
    description: text('description'),
    sourceSnapshotDate: date('source_snapshot_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_vendor_enrichment_normalized').on(table.vendorNameNormalized),
    uniqueIndex('uq_vendor_enrichment_ids').on(
      sql`COALESCE(${table.webVid}, '')`,
      sql`COALESCE(${table.cmblVendorNo}, '')`,
    ),
  ],
)

export const payeeVendorMatches = pgTable(
  'payee_vendor_matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    payeeId: uuid('payee_id')
      .notNull()
      .references(() => payees.id),
    vendorEnrichmentId: uuid('vendor_enrichment_id')
      .notNull()
      .references(() => vendorEnrichment.id),
    matchMethod: text('match_method').notNull(),
    matchConfidence: numeric('match_confidence', { precision: 5, scale: 4 }).notNull(),
    isManualOverride: boolean('is_manual_override').default(false).notNull(),
    reviewStatus: text('review_status').default('unreviewed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('payee_vendor_matches_payee_id_uq').on(table.payeeId),
    index('idx_payee_vendor_matches_vendor').on(table.vendorEnrichmentId),
  ],
)

export const agencyNameCrosswalk = pgTable('agency_name_crosswalk', {
  countyAgencyNameNormalized: text('county_agency_name_normalized').primaryKey(),
  agencyId: uuid('agency_id')
    .notNull()
    .references(() => agencies.id),
  source: text('source').default('manual').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const nigpCommodityCodes = pgTable('nigp_commodity_codes', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vendorCommodityClassMap = pgTable('vendor_commodity_class_map', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorEnrichmentId: uuid('vendor_enrichment_id').references(() => vendorEnrichment.id),
  cmblVendorNo: text('cmbl_vendor_no'),
  commodityCode: text('commodity_code').notNull().references(() => nigpCommodityCodes.code),
  sourceSnapshotDate: date('source_snapshot_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_vendor_commodity').on(table.vendorEnrichmentId, table.commodityCode),
])

// ========== FACTS ==========

export const statePaymentFacts = pgTable(
  'state_payment_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceRowHash: text('source_row_hash').notNull().unique(),
    paymentDate: date('payment_date').notNull(),
    fiscalYear: integer('fiscal_year')
      .notNull()
      .references(() => fiscalYears.fiscalYear),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id),
    payeeId: uuid('payee_id').references(() => payees.id),
    payeeNameRaw: text('payee_name_raw').notNull(),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    objectCategoryRaw: text('object_category_raw'),
    comptrollerObjectCode: text('comptroller_object_code').references(
      () => comptrollerObjects.code,
    ),
    appropriatedFundRaw: text('appropriated_fund_raw'),
    appropriationNumber: text('appropriation_number'),
    appropriationYear: text('appropriation_year'),
    isConfidential: boolean('is_confidential').default(false).notNull(),
    confidentialityNote: text('confidentiality_note'),
    sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_spf_agency_fy').on(table.agencyId, table.fiscalYear),
    index('idx_spf_payee_fy').on(table.payeeId, table.fiscalYear),
    index('idx_spf_fy_date').on(table.fiscalYear, table.paymentDate),
    index('idx_spf_object').on(table.comptrollerObjectCode),
    index('idx_spf_confidential').on(table.isConfidential),
    index('idx_spf_payment_date_desc').on(table.paymentDate),
    index('idx_spf_public_payment_date')
      .on(table.paymentDate)
      .where(sql`${table.isConfidential} = false`),
    index('idx_spf_amount_desc').on(table.amount),
    index('idx_spf_agency_payment_date').on(table.agencyId, table.paymentDate),
    index('idx_spf_payee_payment_date').on(table.payeeId, table.paymentDate),
    index('idx_spf_agency_payee_fy').on(table.agencyId, table.payeeId, table.fiscalYear),
  ],
)

export const countyExpenditureFacts = pgTable(
  'county_expenditure_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fiscalYear: integer('fiscal_year')
      .notNull()
      .references(() => fiscalYears.fiscalYear),
    countyId: uuid('county_id')
      .notNull()
      .references(() => geographiesCounties.id),
    agencyId: uuid('agency_id').references(() => agencies.id),
    agencyNameRaw: text('agency_name_raw').notNull(),
    expenditureTypeRaw: text('expenditure_type_raw').notNull(),
    expenditureCategoryCode: text('expenditure_category_code').references(
      () => expenditureCategories.code,
    ),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    sourceDatasetKey: text('source_dataset_key'),
    sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('cef_unique_key').on(
      table.fiscalYear,
      table.countyId,
      table.agencyNameRaw,
      table.expenditureTypeRaw,
    ),
    index('idx_cef_county_fy').on(table.countyId, table.fiscalYear),
    index('idx_cef_agency_fy').on(table.agencyId, table.fiscalYear),
    index('idx_cef_fy_county_amount').on(table.fiscalYear, table.countyId, table.amount),
  ],
)

export const annualCashReportFacts = pgTable(
  'annual_cash_report_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fiscalYear: integer('fiscal_year')
      .notNull()
      .references(() => fiscalYears.fiscalYear),
    fundNumber: text('fund_number'),
    fundName: text('fund_name'),
    cashBalance: numeric('cash_balance', { precision: 18, scale: 2 }),
    revenueAmount: numeric('revenue_amount', { precision: 18, scale: 2 }),
    expenditureAmount: numeric('expenditure_amount', { precision: 18, scale: 2 }),
    sourceTableName: text('source_table_name'),
    sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('acrf_unique_key').on(table.fiscalYear, table.fundNumber, table.sourceTableName),
    index('idx_acrf_fy').on(table.fiscalYear),
  ],
)

export const dirSalesFacts = pgTable(
  'dir_sales_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceRowHash: text('source_row_hash').notNull().unique(),
    fiscalYear: integer('fiscal_year').notNull(),
    customerNameRaw: text('customer_name_raw').notNull(),
    agencyId: uuid('agency_id').references(() => agencies.id),
    vendorNameRaw: text('vendor_name_raw').notNull(),
    purchaseAmount: numeric('purchase_amount', { precision: 16, scale: 2 }).notNull(),
    contractNumber: text('contract_number'),
    rfoDescription: text('rfo_description'),
    orderQuantity: numeric('order_quantity', { precision: 16, scale: 2 }),
    unitPrice: numeric('unit_price', { precision: 16, scale: 2 }),
    invoiceNumber: text('invoice_number'),
    poNumber: text('po_number'),
    shippedDate: date('shipped_date'),
    contractType: text('contract_type'),
    contractSubtype: text('contract_subtype'),
    staffingContractorName: text('staffing_contractor_name'),
    staffingTitle: text('staffing_title'),
    staffingStartDate: date('staffing_start_date'),
    sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_dsf_agency_fy').on(table.agencyId, table.fiscalYear),
    index('idx_dsf_po_number').on(table.poNumber),
  ],
)

export const travelPaymentFacts = pgTable('travel_payment_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id),
  payeeNameRaw: text('payee_name_raw').notNull(),
  payeeId: uuid('payee_id').references(() => payees.id),
  paymentDate: date('payment_date').notNull(),
  fiscalYear: integer('fiscal_year').notNull().references(() => fiscalYears.fiscalYear),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  travelExpenseTypeRaw: text('travel_expense_type_raw').notNull(),
  sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_tpf_agency_fy').on(table.agencyId, table.fiscalYear),
  index('idx_tpf_payee').on(table.payeeId),
])

export const economicDevelopmentFacts = pgTable('economic_development_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  recipientNameRaw: text('recipient_name_raw').notNull(),
  fundRaw: text('fund_raw'),
  expenditureCategoryRaw: text('expenditure_category_raw'),
  fiscalYear: integer('fiscal_year').notNull().references(() => fiscalYears.fiscalYear),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_edf_fy_recipient').on(table.fiscalYear, table.recipientNameRaw),
])

export const vendorDebarments = pgTable('vendor_debarments', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorIdRaw: text('vendor_id_raw').notNull(),
  vendorNameRaw: text('vendor_name_raw').notNull(),
  addressRaw: text('address_raw'),
  debarmentDate: date('debarment_date').notNull(),
  durationMonths: integer('duration_months'),
  sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_vd_vendor_id').on(table.vendorIdRaw),
])

export const vendorPerformanceReports = pgTable('vendor_performance_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorIdRaw: text('vendor_id_raw').notNull(),
  grade: text('grade').notNull(),
  reportingAgencyRaw: text('reporting_agency_raw'),
  reportDate: date('report_date').notNull(),
  sourceLoadedAt: timestamp('source_loaded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_vpr_vendor_id').on(table.vendorIdRaw),
])


export const paymentOverviewRollups = pgTable('payment_overview_rollups', {
  scopeFiscalYear: integer('scope_fiscal_year').primaryKey(),
  totalSpendAll: numeric('total_spend_all', { precision: 18, scale: 2 }).notNull(),
  totalSpendPublic: numeric('total_spend_public', { precision: 18, scale: 2 }).notNull(),
  paymentCountAll: integer('payment_count_all').notNull(),
  paymentCountPublic: integer('payment_count_public').notNull(),
  agencyCountAll: integer('agency_count_all').notNull(),
  agencyCountPublic: integer('agency_count_public').notNull(),
  payeeCountAll: integer('payee_count_all').notNull(),
  payeeCountPublic: integer('payee_count_public').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const paymentAgencyRollups = pgTable(
  'payment_agency_rollups',
  {
    scopeFiscalYear: integer('scope_fiscal_year').notNull(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id),
    totalSpendAll: numeric('total_spend_all', { precision: 18, scale: 2 }).notNull(),
    totalSpendPublic: numeric('total_spend_public', { precision: 18, scale: 2 }).notNull(),
    paymentCountAll: integer('payment_count_all').notNull(),
    paymentCountPublic: integer('payment_count_public').notNull(),
    distinctPayeeCountAll: integer('distinct_payee_count_all').notNull(),
    distinctPayeeCountPublic: integer('distinct_payee_count_public').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeFiscalYear, table.agencyId] }),
    index('idx_par_scope_total_public').on(table.scopeFiscalYear, table.totalSpendPublic),
    index('idx_par_scope_total_all').on(table.scopeFiscalYear, table.totalSpendAll),
  ],
)

export const paymentPayeeRollups = pgTable(
  'payment_payee_rollups',
  {
    scopeFiscalYear: integer('scope_fiscal_year').notNull(),
    payeeId: uuid('payee_id')
      .notNull()
      .references(() => payees.id),
    totalAmountAll: numeric('total_amount_all', { precision: 18, scale: 2 }).notNull(),
    totalAmountPublic: numeric('total_amount_public', { precision: 18, scale: 2 }).notNull(),
    paymentCountAll: integer('payment_count_all').notNull(),
    paymentCountPublic: integer('payment_count_public').notNull(),
    agencyCountAll: integer('agency_count_all').notNull(),
    agencyCountPublic: integer('agency_count_public').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeFiscalYear, table.payeeId] }),
    index('idx_ppr_scope_total_public').on(table.scopeFiscalYear, table.totalAmountPublic),
    index('idx_ppr_scope_total_all').on(table.scopeFiscalYear, table.totalAmountAll),
  ],
)

export const paymentCategoryRollups = pgTable(
  'payment_category_rollups',
  {
    scopeFiscalYear: integer('scope_fiscal_year').notNull(),
    categoryCode: text('category_code').notNull(),
    categoryTitle: text('category_title').notNull(),
    totalAmountAll: numeric('total_amount_all', { precision: 18, scale: 2 }).notNull(),
    totalAmountPublic: numeric('total_amount_public', { precision: 18, scale: 2 }).notNull(),
    paymentCountAll: integer('payment_count_all').notNull(),
    paymentCountPublic: integer('payment_count_public').notNull(),
    agencyCountAll: integer('agency_count_all').notNull(),
    agencyCountPublic: integer('agency_count_public').notNull(),
    payeeCountAll: integer('payee_count_all').notNull(),
    payeeCountPublic: integer('payee_count_public').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeFiscalYear, table.categoryCode] }),
    index('idx_pcr_scope_total_public').on(table.scopeFiscalYear, table.totalAmountPublic),
    index('idx_pcr_scope_total_all').on(table.scopeFiscalYear, table.totalAmountAll),
  ],
)

export const paymentObjectRollups = pgTable(
  'payment_object_rollups',
  {
    scopeFiscalYear: integer('scope_fiscal_year').notNull(),
    objectCode: text('object_code')
      .notNull()
      .references(() => comptrollerObjects.code),
    objectTitle: text('object_title').notNull(),
    objectGroup: text('object_group'),
    totalAmountAll: numeric('total_amount_all', { precision: 18, scale: 2 }).notNull(),
    totalAmountPublic: numeric('total_amount_public', { precision: 18, scale: 2 }).notNull(),
    paymentCountAll: integer('payment_count_all').notNull(),
    paymentCountPublic: integer('payment_count_public').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeFiscalYear, table.objectCode] }),
    index('idx_por_scope_total_public').on(table.scopeFiscalYear, table.totalAmountPublic),
    index('idx_por_scope_total_all').on(table.scopeFiscalYear, table.totalAmountAll),
  ],
)

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobName: text('job_name').notNull(),
    sourceName: text('source_name').notNull(),
    sourceUrl: text('source_url'),
    sourceDatasetId: text('source_dataset_id'),
    sourceFileName: text('source_file_name'),
    artifactChecksumSha256: text('artifact_checksum_sha256'),
    rowsIn: integer('rows_in'),
    rowsStaged: integer('rows_staged'),
    rowsInserted: integer('rows_inserted'),
    rowsUpdated: integer('rows_updated'),
    rowsRejected: integer('rows_rejected'),
    status: text('status').notNull(),
    errorText: text('error_text'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [index('idx_ingestion_runs_job_started').on(table.jobName, table.startedAt)],
)

// ========== STAGING ==========

export const stgTravelPaymentRaw = pgTable('stg_travel_payment_raw', {
  id: serial('id').primaryKey(),
  agencyName: text('agency_name'),
  payeeName: text('payee_name'),
  paymentDate: text('payment_date'),
  amount: numeric('amount', { precision: 16, scale: 2 }),
  travelExpenseType: text('travel_expense_type'),
  fiscalYear: integer('fiscal_year'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgEconomicDevelopmentRaw = pgTable('stg_economic_development_raw', {
  id: serial('id').primaryKey(),
  recipientName: text('recipient_name'),
  fund: text('fund'),
  expenditureCategory: text('expenditure_category'),
  fiscalYear: integer('fiscal_year'),
  amount: numeric('amount', { precision: 18, scale: 2 }),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgNigpCommodityCodesRaw = pgTable('stg_nigp_commodity_codes_raw', {
  id: serial('id').primaryKey(),
  classItemCode: text('class_item_code'),
  commodityTitle: text('commodity_title'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgVendorCommodityClassRaw = pgTable('stg_vendor_commodity_class_raw', {
  id: serial('id').primaryKey(),
  cmblVendorNo: text('cmbl_vendor_no'),
  classItemCode: text('class_item_code'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgVendorDebarmentRaw = pgTable('stg_vendor_debarment_raw', {
  id: serial('id').primaryKey(),
  vendorIdRaw: text('vendor_id_raw'),
  vendorNameRaw: text('vendor_name_raw'),
  addressRaw: text('address_raw'),
  debarmentDate: text('debarment_date'),
  durationMonths: integer('duration_months'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgVendorPerformanceRaw = pgTable('stg_vendor_performance_raw', {
  id: serial('id').primaryKey(),
  vendorIdRaw: text('vendor_id_raw'),
  grade: text('grade'),
  reportingAgencyRaw: text('reporting_agency_raw'),
  reportDate: text('report_date'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgLbbContractAwardsRaw = pgTable('stg_lbb_contract_awards_raw', {
  id: serial('id').primaryKey(),
  contractId: text('contract_id'),
  agencyNameRaw: text('agency_name_raw'),
  vendorNameRaw: text('vendor_name_raw'),
  awardDate: text('award_date'),
  totalValue: numeric('total_value', { precision: 18, scale: 2 }),
  subject: text('subject'),
  documentUrls: text('document_urls'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgEsbdSolicitationsRaw = pgTable('stg_esbd_solicitations_raw', {
  id: serial('id').primaryKey(),
  solicitationId: text('solicitation_id'),
  agencyNameRaw: text('agency_name_raw'),
  title: text('title'),
  nigpCodes: text('nigp_codes'),
  postedDate: text('posted_date'),
  status: text('status'),
  documentUrls: text('document_urls'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgExpendituresByCountyRaw = pgTable('stg_expenditures_by_county_raw', {
  id: serial('id').primaryKey(),
  fiscalYear: integer('fiscal_year'),
  agencyNumber: text('agency_number'),
  agencyName: text('agency_name'),
  county: text('county'),
  majorSpendingCategory: text('major_spending_category'),
  amount: numeric('amount', { precision: 16, scale: 2 }),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgAnnualCashReportRaw = pgTable('stg_annual_cash_report_raw', {
  id: serial('id').primaryKey(),
  fiscalYear: integer('fiscal_year'),
  sheetName: text('sheet_name'),
  fundNumber: text('fund_number'),
  fundName: text('fund_name'),
  lineItem: text('line_item'),
  amount: numeric('amount', { precision: 18, scale: 2 }),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgVendorMasterRaw = pgTable('stg_vendor_master_raw', {
  id: serial('id').primaryKey(),
  webVendorName: text('web_vendor_name'),
  webVid: text('web_vid'),
  webVendorNo: text('web_vendor_no'),
  webCity: text('web_city'),
  webCounty: text('web_county'),
  webState: text('web_state'),
  webZip: text('web_zip'),
  webHubStatus: integer('web_hub_status'),
  webSmallBusFlag: integer('web_small_bus_flag'),
  webDesc: text('web_desc'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgComptrollerObjectsRaw = pgTable('stg_comptroller_objects_raw', {
  id: serial('id').primaryKey(),
  objectCode: text('object_code'),
  title: text('title'),
  objectGroup: text('object_group'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgExpenditureCategoriesRaw = pgTable('stg_expenditure_categories_raw', {
  id: serial('id').primaryKey(),
  categoryCode: text('category_code'),
  categoryTitle: text('category_title'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgPaymentsToPayeeRaw = pgTable('stg_payments_to_payee_raw', {
  id: serial('id').primaryKey(),
  agencyName: text('agency_name'),
  payeeName: text('payee_name'),
  paymentDate: text('payment_date'),
  amount: numeric('amount', { precision: 16, scale: 2 }),
  objectCategory: text('object_category'),
  comptrollerObject: text('comptroller_object'),
  appropriationNumber: text('appropriation_number'),
  appropriationYear: text('appropriation_year'),
  fund: text('fund'),
  isConfidential: integer('is_confidential').default(0),
  fiscalYear: integer('fiscal_year'),
  sourceFileName: text('source_file_name'),
  sourceUrl: text('source_url'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
  rowNumber: integer('row_number'),
})

export const stgDirSalesRaw = pgTable('stg_dir_sales_raw', {
  id: serial('id').primaryKey(),
  fiscalYear: integer('fiscal_year'),
  customerName: text('customer_name'),
  vendorName: text('vendor_name'),
  purchaseAmount: numeric('purchase_amount', { precision: 16, scale: 2 }),
  contractNumber: text('contract_number'),
  rfoDescription: text('rfo_description'),
  orderQuantity: numeric('order_quantity', { precision: 16, scale: 2 }),
  unitPrice: numeric('unit_price', { precision: 16, scale: 2 }),
  invoiceNumber: text('invoice_number'),
  poNumber: text('po_number'),
  shippedDate: text('shipped_date'),
  contractType: text('contract_type'),
  contractSubtype: text('contract_subtype'),
  staffingContractorName: text('staffing_contractor_name'),
  staffingTitle: text('staffing_title'),
  staffingLevel: text('staffing_level'),
  staffingStartDate: text('staffing_start_date'),
  salesFactNumber: text('sales_fact_number'),
  sourceFileName: text('source_file_name'),
  sourceLoadedAt: text('source_loaded_at'),
  sourceSnapshotDate: text('source_snapshot_date'),
})

// ========== BLOG ==========

/**
 * Spotlight angle rotation table.
 * Each row represents one editorial angle (e.g. "agency-spend-leaders").
 * The rotation strategy uses lastUsedAt + useCount to pick the next angle.
 */
export const blogAngles = pgTable('blog_angles', {
  id: text('id').primaryKey(), // e.g. 'agency-spend-leaders'
  name: text('name').notNull(),
  description: text('description').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  useCount: integer('use_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Log of individual analyzer runs — what data was mined and when.
 * Provides an auditable trail of what evidence was gathered before each post.
 */
export const blogAnalyzerRuns = pgTable(
  'blog_analyzer_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    angleId: text('angle_id')
      .notNull()
      .references(() => blogAngles.id),
    status: text('status').notNull(), // 'pending' | 'completed' | 'failed'
    findingsJson: jsonb('findings_json'), // SpotlightFindings payload
    errorText: text('error_text'),
    dataAsOfFiscalYear: integer('data_as_of_fiscal_year'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [index('idx_blog_analyzer_runs_angle').on(table.angleId, table.startedAt)],
)

/**
 * Published and draft blog posts.
 * Each post is linked to the angle that generated it and the analyzer run
 * that produced the underlying evidence.
 */
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    author: text('author').notNull().default('narduk@mac.com'),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull(),
    body: jsonb('body').notNull(), // Structured PostBody object
    angleId: text('angle_id')
      .notNull()
      .references(() => blogAngles.id),
    analyzerRunId: uuid('analyzer_run_id').references(() => blogAnalyzerRuns.id),
    findingsJson: jsonb('findings_json'), // SpotlightFindings snapshot
    status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'archived'
    publishedAt: timestamp('published_at', { withTimezone: true }),
    generationModel: text('generation_model'),
    generationPromptKey: text('generation_prompt_key'),
    indexNowSubmitted: boolean('index_now_submitted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blog_posts_status_published').on(table.status, table.publishedAt),
    index('idx_blog_posts_angle').on(table.angleId),
  ],
)

// ========== INVESTIGATIONS ==========

/**
 * Admin-only investigative research backlog.
 * Stores structured dossiers for manual newsroom follow-up.
 */
export const investigationTopics = pgTable(
  'investigation_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    priorityRank: integer('priority_rank').notNull(),
    status: text('status').notNull().default('backlog'),
    lane: text('lane').notNull(),
    flaggedPattern: text('flagged_pattern').notNull(),
    impact: text('impact').notNull(),
    difficulty: text('difficulty').notNull(),
    summary: text('summary').notNull(),
    investigativeQuestion: text('investigative_question').notNull(),
    publicImpact: text('public_impact').notNull(),
    notes: text('notes').notNull().default(''),
    sourceReferences: jsonb('source_references')
      .$type<Array<{ label: string; note: string; url: string | null }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    recordsToObtain: jsonb('records_to_obtain')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    reportingSteps: jsonb('reporting_steps')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    visualIdeas: jsonb('visual_ideas')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_investigation_topics_status').on(table.status),
    index('idx_investigation_topics_priority_updated').on(table.priorityRank, table.updatedAt),
  ],
)

export const stgBeverageSalesRaw = pgTable('stg_beverage_sales_raw', {
  taxpayerNumber: text('taxpayer_number'),
  taxpayerName: text('taxpayer_name'),
  taxpayerAddress: text('taxpayer_address'),
  taxpayerCity: text('taxpayer_city'),
  taxpayerState: text('taxpayer_state'),
  taxpayerZip: text('taxpayer_zip'),
  taxpayerCounty: text('taxpayer_county'),
  locationNumber: text('location_number'),
  locationName: text('location_name'),
  locationAddress: text('location_address'),
  locationCity: text('location_city'),
  locationState: text('location_state'),
  locationZip: text('location_zip'),
  locationCounty: text('location_county'),
  insideOutsideCityLimits: text('inside_outside_city_limits'),
  tabcPermitNumber: text('tabc_permit_number'),
  responsibilityBeginDate: text('responsibility_begin_date'),
  responsibilityEndDate: text('responsibility_end_date'),
  obligationEndDate: text('obligation_end_date'),
  totalSalesReceipts: text('total_sales_receipts'),
  totalTaxableReceipts: text('total_taxable_receipts'),
})

export const beverageSalesFacts = pgTable(
  'beverage_sales_facts',
  {
    id: serial('id').primaryKey(),
    sourceRowHash: text('source_row_hash').notNull().unique(),
    payeeId: uuid('payee_id').references(() => payees.id), // Fuzzy matched Taxpayer -> Payee using pg_trgm
    locationNameRaw: text('location_name_raw'),
    locationCity: text('location_city'),
    taxpayerNameRaw: text('taxpayer_name_raw'),
    tabcPermitNumber: text('tabc_permit_number'),
    totalSalesReceipts: numeric('total_sales_receipts', { precision: 15, scale: 2 }),
    totalTaxableReceipts: numeric('total_taxable_receipts', { precision: 15, scale: 2 }),
    obligationEndDate: timestamp('obligation_end_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bsf_payee_id').on(table.payeeId),
  ],
)



// ========== VENDOR IDENTITY GRAPH ==========

export const agencyExternalIds = pgTable('agency_external_ids', {
  id: uuid('id').defaultRandom().primaryKey(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id),
  system: text('system').notNull(),
  externalId: text('external_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('agency_external_ids_system_uq').on(table.system, table.externalId)
])

export const vendorEntities = pgTable('vendor_entities', {
  vendorEntityId: text('vendor_entity_id').primaryKey(),
  canonicalName: text('canonical_name').notNull(),
  canonicalNameNormalized: text('canonical_name_normalized').notNull(),
  canonicalSlug: text('canonical_slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vendorIdentifiers = pgTable('vendor_identifiers', {
  id: text('id').primaryKey(),
  vendorEntityId: text('vendor_entity_id').notNull().references(() => vendorEntities.vendorEntityId),
  idType: text('id_type').notNull(),
  idValue: text('id_value').notNull(),
  sourceSystem: text('source_system').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('vendor_identifiers_type_val_uq').on(table.idType, table.idValue)
])

export const vendorAliases = pgTable('vendor_aliases', {
  id: text('id').primaryKey(),
  vendorEntityId: text('vendor_entity_id').notNull().references(() => vendorEntities.vendorEntityId),
  aliasName: text('alias_name').notNull(),
  aliasNameNormalized: text('alias_name_normalized').notNull(),
  sourceSystem: text('source_system').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vendorPayeeLinks = pgTable('vendor_payee_links', {
  id: text('id').primaryKey(),
  payeeId: uuid('payee_id').notNull().references(() => payees.id),
  vendorEntityId: text('vendor_entity_id').notNull().references(() => vendorEntities.vendorEntityId),
  matchMethod: text('match_method').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('vendor_payee_links_payee_uq').on(table.payeeId)
])

// ========== PROCUREMENT & CONTRACT EXTENSIONS ==========

export const lbbContracts = pgTable('lbb_contracts', {
  id: text('id').primaryKey(),
  agencyCode: text('agency_code').notNull(),
  contractNumber: text('contract_number').notNull(),
  subject: text('subject'),
  purchaseRequisitionNumber: text('purchase_requisition_number'),
  agencyApprovalDate: timestamp('agency_approval_date', { withTimezone: true }),
  solicitationPostDate: timestamp('solicitation_post_date', { withTimezone: true }),
  awardDate: timestamp('award_date', { withTimezone: true }),
  requisitionDate: timestamp('requisition_date', { withTimezone: true }),
  completionDate: timestamp('completion_date', { withTimezone: true }),
  currentValueUsd: numeric('current_value_usd', { precision: 18, scale: 2 }),
  maximumValueUsd: numeric('maximum_value_usd', { precision: 18, scale: 2 }),
  competitiveType: text('competitive_type'),
  revenueGenerating: boolean('revenue_generating'),
  pccCodesJson: jsonb('pcc_codes_json'),
  reportRequirementCodesJson: jsonb('report_requirement_codes_json'),
  vendorNameRaw: text('vendor_name_raw'),
  vendorAddress1: text('vendor_address1'),
  vendorAddress2: text('vendor_address2'),
  vendorAddress3: text('vendor_address3'),
  vendorAddress4: text('vendor_address4'),
  vendorCity: text('vendor_city'),
  vendorState: text('vendor_state'),
  vendorPostalCode: text('vendor_postal_code'),
  vendorAreaCode: text('vendor_area_code'),
  vendorPhoneNumber: text('vendor_phone_number'),
  attachmentsCount: integer('attachments_count'),
  ingestionRunId: text('ingestion_run_id').notNull(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('lbb_contracts_agency_number_uq').on(table.agencyCode, table.contractNumber)
])

export const esbdSolicitations = pgTable('esbd_solicitations', {
  id: text('id').primaryKey(),
  solicitationId: text('solicitation_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  agencyMemberNumber: text('agency_member_number').notNull(),
  postingDate: timestamp('posting_date', { withTimezone: true }),
  createdDatetime: timestamp('created_datetime', { withTimezone: true }),
  lastUpdatedDatetime: timestamp('last_updated_datetime', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  dueTime: text('due_time'),
  detailsUrl: text('details_url').notNull(),
  ingestionRunId: text('ingestion_run_id').notNull(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const esbdSolicitationDetails = pgTable('esbd_solicitations_details', {
  solicitationId: text('solicitation_id').primaryKey(),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  postingRequirement: text('posting_requirement'),
  procurementCertification: text('procurement_certification'),
  solicitationPostingDate: timestamp('solicitation_posting_date', { withTimezone: true }),
  lastModifiedDatetime: timestamp('last_modified_datetime', { withTimezone: true }),
  classItemCodesRaw: text('class_item_codes_raw'),
  addendumText: text('addendum_text'),
  solicitationDescription: text('solicitation_description'),
  ingestionRunId: text('ingestion_run_id').notNull(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const esbdAttachments = pgTable('esbd_attachments', {
  id: text('id').primaryKey(),
  solicitationId: text('solicitation_id').notNull().references(() => esbdSolicitationDetails.solicitationId),
  attachmentName: text('attachment_name').notNull(),
  attachmentDescription: text('attachment_description'),
  attachmentUrl: text('attachment_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dirContracts = pgTable('dir_contracts', {
  dirContractNumber: text('dir_contract_number').primaryKey(),
  vendorVid: text('vendor_vid'),
  vendorName: text('vendor_name'),
  rfo: text('rfo'),
  contractStatus: text('contract_status'),
  contractStartDate: timestamp('contract_start_date', { withTimezone: true }),
  contractTermDate: timestamp('contract_term_date', { withTimezone: true }),
  contractExpirationDate: timestamp('contract_expiration_date', { withTimezone: true }),
  commodityCodesJson: jsonb('commodity_codes_json'),
  productsServicesJson: jsonb('products_services_json'),
  contractDocumentsJson: jsonb('contract_documents_json'),
  ingestionRunId: text('ingestion_run_id').notNull(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const usaspendingAwardTransactions = pgTable('usaspending_award_transactions', {
  id: text('id').primaryKey(),
  generatedUniqueAwardId: text('generated_unique_award_id'),
  awardId: text('award_id'),
  actionDate: timestamp('action_date', { withTimezone: true }),
  federalActionObligation: numeric('federal_action_obligation', { precision: 18, scale: 2 }),
  awardType: text('award_type'),
  recipientName: text('recipient_name'),
  recipientUei: text('recipient_uei'),
  recipientParentName: text('recipient_parent_name'),
  recipientParentUei: text('recipient_parent_uei'),
  recipientStateCode: text('recipient_state_code'),
  placeOfPerformanceStateCode: text('place_of_performance_state_code'),
  awardingAgencyName: text('awarding_agency_name'),
  fundingAgencyName: text('funding_agency_name'),
  rawRowJson: jsonb('raw_row_json').notNull(),
  ingestionRunId: text('ingestion_run_id').notNull(),
  sourceRowHash: text('source_row_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
