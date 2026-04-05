import re

# ------------- TRAVEL SCRAPER -------------
with open('tools/etl/travel-scraper.ts', 'r') as f:
    t_content = f.read()

t_content = t_content.replace(".data/payments", ".data/travel_payments")
t_content = t_content.replace("{ x: 70, y: 196 }", "{ x: 70, y: 220 }")
t_content = t_content.replace("PAYMENTS_SHEET_COORDINATES", "TRAVEL_SHEET_COORDINATES")
t_content = t_content.replace("payments-ingest.sql", "travel-ingest.sql")
t_content = t_content.replace("stg_payments_to_payee_raw", "stg_travel_payment_raw")

# Replace STAGING_COLUMNS
t_content = re.sub(
    r"const STAGING_COLUMNS = \[.*?\]",
    "const STAGING_COLUMNS = [\n  'agency_name',\n  'payee_name',\n  'payment_date',\n  'amount',\n  'travel_expense_type',\n  'fiscal_year',\n  'source_file_name',\n  'source_url',\n  'source_loaded_at',\n  'source_snapshot_date',\n  'row_number',\n]",
    t_content,
    flags=re.DOTALL
)

# Replace ParsedPaymentRow
t_content = re.sub(
    r"type ParsedPaymentRow = \{.*?\}",
    "type ParsedPaymentRow = {\n  agency_name: string\n  payee_name: string\n  payment_date: string\n  amount: string\n  travel_expense_type: string\n  fiscal_year: string\n  source_file_name: string\n  source_url: string\n  source_loaded_at: string\n  source_snapshot_date: string\n  row_number: string\n}",
    t_content,
    flags=re.DOTALL
)

# Replace parseWorkbookToRows body loop
old_loop = """    const fiscalYear = row[0]?.trim()
    const payee = row[1]?.trim()
    const agency = row[2]?.trim()
    const objectCategory = row[3]?.trim()
    const fund = row[4]?.trim()
    const comptrollerObject = row[5]?.trim()
    const paymentDate = row[7]?.trim()
    const amount = row[8]?.trim()

    if (!fiscalYear || !agency || !payee || !paymentDate || !amount) {
      continue
    }

    parsedRows.push({
      agency_name: agency,
      payee_name: payee,
      payment_date: parseDate(paymentDate),
      amount: parseCurrency(amount),
      object_category: objectCategory || '',
      comptroller_object: comptrollerObject || '',
      appropriation_number: '',
      appropriation_year: '',
      fund: fund || '',
      is_confidential: payee.toUpperCase() === 'CONFIDENTIAL' ? '1' : '0',
      fiscal_year: fiscalYear || String(metadata.fiscalYear),
      source_file_name: basename(workbookPath),
      source_url: PAYMENTS_DOCUMENT_URL,
      source_loaded_at: metadata.sourceLoadedAt,
      source_snapshot_date: metadata.snapshotDate,
      row_number: String(index + 1),
    })"""
new_loop = """    const fiscalYear = row[0]?.trim()
    const agency = row[1]?.trim()
    const payee = row[2]?.trim()
    const travelExpenseType = row[3]?.trim()
    const paymentDate = row[4]?.trim()
    const amount = row[5]?.trim()

    if (!fiscalYear || !agency || !payee || !paymentDate || !amount) {
      continue
    }

    parsedRows.push({
      agency_name: agency,
      payee_name: payee,
      payment_date: parseDate(paymentDate),
      amount: parseCurrency(amount),
      travel_expense_type: travelExpenseType || '',
      fiscal_year: fiscalYear || String(metadata.fiscalYear),
      source_file_name: basename(workbookPath),
      source_url: PAYMENTS_DOCUMENT_URL,
      source_loaded_at: metadata.sourceLoadedAt,
      source_snapshot_date: metadata.snapshotDate,
      row_number: String(index + 1),
    })"""
t_content = t_content.replace(old_loop, new_loop)

with open('tools/etl/travel-scraper.ts', 'w') as f:
    f.write(t_content)


# ------------- ECONOMIC SCRAPER -------------
with open('tools/etl/economic-scraper.ts', 'r') as f:
    e_content = f.read()

e_content = e_content.replace(".data/payments", ".data/economic_development")
e_content = e_content.replace("{ x: 70, y: 196 }", "{ x: 70, y: 244 }")
e_content = e_content.replace("PAYMENTS_SHEET_COORDINATES", "ECONOMIC_SHEET_COORDINATES")
e_content = e_content.replace("payments-ingest.sql", "economic-ingest.sql")
e_content = e_content.replace("stg_payments_to_payee_raw", "stg_economic_development_raw")

# Replace STAGING_COLUMNS
e_content = re.sub(
    r"const STAGING_COLUMNS = \[.*?\]",
    "const STAGING_COLUMNS = [\n  'recipient_name',\n  'fund',\n  'expenditure_category',\n  'fiscal_year',\n  'amount',\n  'source_file_name',\n  'source_url',\n  'source_loaded_at',\n  'source_snapshot_date',\n  'row_number',\n]",
    e_content,
    flags=re.DOTALL
)

# Replace ParsedPaymentRow
e_content = re.sub(
    r"type ParsedPaymentRow = \{.*?\}",
    "type ParsedPaymentRow = {\n  recipient_name: string\n  fund: string\n  expenditure_category: string\n  fiscal_year: string\n  amount: string\n  source_file_name: string\n  source_url: string\n  source_loaded_at: string\n  source_snapshot_date: string\n  row_number: string\n}",
    e_content,
    flags=re.DOTALL
)

new_econ_loop = """    const fiscalYear = row[0]?.trim()
    const recipient = row[1]?.trim()
    const fund = row[2]?.trim()
    const expenditureCategory = row[3]?.trim()
    const amount = row[4]?.trim()

    if (!fiscalYear || !recipient || !amount) {
      continue
    }

    parsedRows.push({
      recipient_name: recipient,
      fund: fund || '',
      expenditure_category: expenditureCategory || '',
      amount: parseCurrency(amount),
      fiscal_year: fiscalYear || String(metadata.fiscalYear),
      source_file_name: basename(workbookPath),
      source_url: PAYMENTS_DOCUMENT_URL,
      source_loaded_at: metadata.sourceLoadedAt,
      source_snapshot_date: metadata.snapshotDate,
      row_number: String(index + 1),
    })"""
e_content = e_content.replace(old_loop, new_econ_loop)

with open('tools/etl/economic-scraper.ts', 'w') as f:
    f.write(e_content)

print("Done")
