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
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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
