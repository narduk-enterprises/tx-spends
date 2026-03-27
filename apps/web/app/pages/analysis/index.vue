<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  FISCAL_YEAR_OPTIONS,
  formatPct,
  formatUsd,
  formatUsdCompact,
  getBooleanQueryValue,
  getNumberQueryValue,
  getStringQueryValue,
} from '~/utils/explorer'

type AnalysisMode = 'trends' | 'concentration' | 'outliers' | 'relationships'
type AnalysisDataset = 'payments' | 'counties'
type AnalysisSubject = 'system' | 'agency' | 'payee' | 'county'
type AnalysisBreakdown = 'agency' | 'payee' | 'category' | 'object' | 'county' | 'expenditure_type'
type AnalysisRelationship = 'agency_payee' | 'agency_category' | 'payee_category' | 'agency_object'
type FilterValue = string | number | boolean | null

interface AnalysisMeta {
  currency: 'USD'
  dataset: AnalysisDataset
  subject: AnalysisSubject
  subject_label: string
  breakdown?: AnalysisBreakdown
  relationship?: AnalysisRelationship
  methodology: string[]
  warnings: string[]
  drill_path: 'transactions' | 'county_annual'
  comparison_years?: {
    current: number
    prior: number
  }
}

interface TimeSeriesPoint extends Record<string, string | number | null> {
  fiscal_year: number
  amount: number
}

interface TrendSeries {
  id: string
  label: string
  points: TimeSeriesPoint[]
  latest_amount: number
  yoy_delta: number | null
  yoy_pct: number | null
  cagr: number | null
  volatility: number | null
  summary: string
}

interface TrendAnalysisData {
  summary: string
  series: TrendSeries[]
}

interface ConcentrationItem extends Record<string, string | number | null> {
  id: string
  label: string
  amount: number
  share: number
  cumulative_share: number
}

interface ConcentrationAnalysisData {
  summary: string
  total_amount: number
  top_5_share: number
  top_10_share: number
  top_25_share: number
  hhi: number
  interpretation: string
  items: ConcentrationItem[]
}

interface OutlierItem extends Record<string, string | number | null> {
  id: string
  label: string
  current_amount: number
  prior_amount: number
  delta_amount: number
  pct_change: number | null
  reason: string
}

interface OutlierAnalysisData {
  summary: string
  current_fiscal_year: number
  prior_fiscal_year: number
  increases: OutlierItem[]
  decreases: OutlierItem[]
}

interface RelationshipEdge extends Record<string, string | number | null> {
  left_id: string
  left_label: string
  right_id: string
  right_label: string
  amount: number
  share_of_left: number
  share_of_right: number
}

interface RelationshipAnalysisData {
  summary: string
  edges: RelationshipEdge[]
}

type AnalysisPayload =
  | TrendAnalysisData
  | ConcentrationAnalysisData
  | OutlierAnalysisData
  | RelationshipAnalysisData

interface AnalysisApiResponse {
  data: AnalysisPayload
  meta: AnalysisMeta
  filters_applied: Record<string, unknown>
}

const route = useRoute('/analysis')
const router = useRouter()

const mode = computed<AnalysisMode>(() => {
  const value = getStringQueryValue(route.query.mode)
  return value === 'trends' ||
    value === 'concentration' ||
    value === 'outliers' ||
    value === 'relationships'
    ? value
    : 'outliers'
})

const dataset = computed<AnalysisDataset>(() => {
  const value = getStringQueryValue(route.query.dataset)
  return value === 'counties' ? 'counties' : 'payments'
})

const subject = computed<AnalysisSubject>(() => {
  const value = getStringQueryValue(route.query.subject)
  if (value === 'agency' || value === 'payee' || value === 'county') {
    return value
  }
  return 'system'
})

const breakdown = computed<AnalysisBreakdown | undefined>(() => {
  const value = getStringQueryValue(route.query.breakdown)
  return value === 'agency' ||
    value === 'payee' ||
    value === 'category' ||
    value === 'object' ||
    value === 'county' ||
    value === 'expenditure_type'
    ? value
    : undefined
})

const relationship = computed<AnalysisRelationship>(() => {
  const value = getStringQueryValue(route.query.relationship)
  return value === 'agency_category' ||
    value === 'payee_category' ||
    value === 'agency_object' ||
    value === 'agency_payee'
    ? value
    : 'agency_payee'
})

const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const fiscalYearStart = computed(() => getNumberQueryValue(route.query.fy_start))
const fiscalYearEnd = computed(() => getNumberQueryValue(route.query.fy_end))
const includeConfidential = computed(() => getBooleanQueryValue(route.query.includeConfidential))
const agencyId = computed(() => getStringQueryValue(route.query.agency_id))
const payeeId = computed(() => getStringQueryValue(route.query.payee_id))
const countyId = computed(() => getStringQueryValue(route.query.county_id))
const minChangeAmount = computed(() => getNumberQueryValue(route.query.min_change_amount))
const minChangePct = computed(() => getNumberQueryValue(route.query.min_change_pct))

const requestQuery = computed(() =>
  cleanQueryObject({
    mode: mode.value,
    dataset: dataset.value,
    subject: subject.value,
    breakdown: breakdown.value,
    relationship: relationship.value,
    fiscal_year: fiscalYear.value,
    fiscal_year_start: fiscalYearStart.value,
    fiscal_year_end: fiscalYearEnd.value,
    include_confidential: includeConfidential.value ? 'true' : undefined,
    agency_id: agencyId.value,
    payee_id: payeeId.value,
    county_id: countyId.value,
    min_change_amount: minChangeAmount.value,
    min_change_pct: minChangePct.value,
    limit: mode.value === 'relationships' ? 20 : 10,
  }),
)

const requestKey = computed(() => buildFetchKey(`analysis:${mode.value}`, requestQuery.value))

const { data, status, error } = await useLazyFetch<AnalysisApiResponse>(
  () => `/api/v1/analysis/${mode.value}`,
  {
    key: requestKey,
    query: requestQuery,
  },
)

const meta = computed<AnalysisMeta | null>(() => data.value?.meta ?? null)
const trendAnalysis = computed<TrendAnalysisData | null>(() =>
  mode.value === 'trends' ? ((data.value?.data as TrendAnalysisData | undefined) ?? null) : null,
)
const concentrationAnalysis = computed<ConcentrationAnalysisData | null>(() =>
  mode.value === 'concentration'
    ? ((data.value?.data as ConcentrationAnalysisData | undefined) ?? null)
    : null,
)
const outlierAnalysis = computed<OutlierAnalysisData | null>(() =>
  mode.value === 'outliers'
    ? ((data.value?.data as OutlierAnalysisData | undefined) ?? null)
    : null,
)
const relationshipAnalysis = computed<RelationshipAnalysisData | null>(() =>
  mode.value === 'relationships'
    ? ((data.value?.data as RelationshipAnalysisData | undefined) ?? null)
    : null,
)
const relationshipLabel = computed(() =>
  meta.value?.relationship ? meta.value.relationship.replace('_', ' ↔ ') : 'N/A',
)
const activeBreakdown = computed(() => meta.value?.breakdown || 'n/a')
const comparisonYears = computed(() => meta.value?.comparison_years ?? null)

const subjectNeedsIdentifier = computed(
  () =>
    (subject.value === 'agency' && !agencyId.value) ||
    (subject.value === 'payee' && !payeeId.value) ||
    (subject.value === 'county' && !countyId.value),
)

const title = computed(() => {
  const datasetLabel = dataset.value === 'payments' ? 'Payment' : 'County'
  const modeLabel = mode.value.charAt(0).toUpperCase() + mode.value.slice(1)
  return `${modeLabel} Analysis | ${datasetLabel} Investigation Console`
})

const description = computed(() =>
  dataset.value === 'payments'
    ? 'Investigate Texas state payment trends, concentration, outliers, and observed relationships without blurring county geography boundaries.'
    : 'Investigate annual Texas county expenditure trends, concentration, and outliers without implying county-level transaction geography.',
)

const robots = computed(() =>
  subject.value !== 'system' || Boolean(breakdown.value) ? 'noindex,follow' : 'index,follow',
)

useSeo({
  title,
  description,
  robots,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-chart-column-big',
  },
})

useWebPageSchema({
  name: title,
  description,
  type: 'CollectionPage',
})

const tabs = [
  { label: 'Outliers', key: 'outliers', icon: 'i-lucide-siren' },
  { label: 'Concentration', key: 'concentration', icon: 'i-lucide-pie-chart' },
  { label: 'Trends', key: 'trends', icon: 'i-lucide-chart-line' },
  { label: 'Relationships', key: 'relationships', icon: 'i-lucide-share-2' },
]

const datasetOptions = [
  { label: 'State payments', value: 'payments' },
  { label: 'County annual expenditure', value: 'counties' },
]

const subjectOptions = computed(() =>
  dataset.value === 'payments'
    ? [
        { label: 'Systemwide', value: 'system' },
        { label: 'Agency focus', value: 'agency' },
        { label: 'Payee focus', value: 'payee' },
      ]
    : [
        { label: 'Systemwide', value: 'system' },
        { label: 'County focus', value: 'county' },
        { label: 'Agency focus', value: 'agency' },
      ],
)

const breakdownOptions = computed(() => {
  if (dataset.value === 'counties') {
    if (subject.value === 'county') {
      return [
        { label: 'Agency', value: 'agency' },
        { label: 'Expenditure type', value: 'expenditure_type' },
      ]
    }
    return [
      { label: 'County', value: 'county' },
      { label: 'Agency', value: 'agency' },
      { label: 'Expenditure type', value: 'expenditure_type' },
    ]
  }

  if (subject.value === 'agency') {
    return [
      { label: 'Payee', value: 'payee' },
      { label: 'Category', value: 'category' },
      { label: 'Object', value: 'object' },
    ]
  }

  if (subject.value === 'payee') {
    return [
      { label: 'Agency', value: 'agency' },
      { label: 'Category', value: 'category' },
    ]
  }

  return [
    { label: 'Agency', value: 'agency' },
    { label: 'Payee', value: 'payee' },
    { label: 'Category', value: 'category' },
    { label: 'Object', value: 'object' },
  ]
})

const relationshipOptions = [
  { label: 'Agency ↔ payee', value: 'agency_payee' },
  { label: 'Agency ↔ category', value: 'agency_category' },
  { label: 'Payee ↔ category', value: 'payee_category' },
  { label: 'Agency ↔ object', value: 'agency_object' },
]

const filters = computed({
  get: () => ({
    dataset: dataset.value,
    subject: subject.value,
    breakdown: breakdown.value || null,
    relationship: relationship.value,
    fiscal_year: fiscalYear.value ? String(fiscalYear.value) : null,
    fiscal_year_start: fiscalYearStart.value ? String(fiscalYearStart.value) : null,
    fiscal_year_end: fiscalYearEnd.value ? String(fiscalYearEnd.value) : null,
    agency_id: agencyId.value || null,
    payee_id: payeeId.value || null,
    county_id: countyId.value || null,
    min_change_amount: minChangeAmount.value ? String(minChangeAmount.value) : null,
    min_change_pct: minChangePct.value ? String(minChangePct.value) : null,
    include_confidential: includeConfidential.value,
  }),
  set: (value: Record<string, FilterValue>) => {
    router.replace({
      query: cleanQueryObject({
        ...route.query,
        mode: mode.value,
        dataset: toQueryString(value.dataset),
        subject: toQueryString(value.subject),
        breakdown: toQueryString(value.breakdown),
        relationship: toQueryString(value.relationship),
        fy:
          value.fiscal_year && value.fiscal_year !== 'all' ? String(value.fiscal_year) : undefined,
        fy_start: toQueryString(value.fiscal_year_start),
        fy_end: toQueryString(value.fiscal_year_end),
        agency_id: toQueryString(value.agency_id),
        payee_id: toQueryString(value.payee_id),
        county_id: toQueryString(value.county_id),
        min_change_amount: toQueryString(value.min_change_amount),
        min_change_pct: toQueryString(value.min_change_pct),
        includeConfidential: value.include_confidential ? 'true' : undefined,
      }),
    })
  },
})

const availableFilters = computed(() => {
  const base = [
    { key: 'dataset', label: 'Dataset', type: 'select', options: datasetOptions },
    { key: 'subject', label: 'Subject', type: 'select', options: subjectOptions.value },
    { key: 'breakdown', label: 'Breakdown', type: 'select', options: breakdownOptions.value },
    { key: 'fiscal_year', label: 'Fiscal year', type: 'select', options: FISCAL_YEAR_OPTIONS },
    { key: 'fiscal_year_start', label: 'FY start', type: 'input', placeholder: '2021' },
    { key: 'fiscal_year_end', label: 'FY end', type: 'input', placeholder: '2026' },
    {
      key: 'include_confidential',
      label: 'Include confidential rows',
      type: 'boolean',
    },
  ] as Array<{
    key: string
    label: string
    type: 'select' | 'input' | 'boolean'
    placeholder?: string
    options?: { label: string; value: string | number | boolean }[]
  }>

  if (mode.value === 'relationships') {
    base.splice(3, 0, {
      key: 'relationship',
      label: 'Relationship',
      type: 'select',
      options: relationshipOptions,
    })
  }

  if (mode.value === 'outliers') {
    base.push(
      {
        key: 'min_change_amount',
        label: 'Min change amount',
        type: 'input',
        placeholder: '1000000',
      },
      { key: 'min_change_pct', label: 'Min change %', type: 'input', placeholder: '25' },
    )
  }

  if (subject.value === 'agency') {
    base.push({
      key: 'agency_id',
      label: 'Agency id',
      type: 'input',
      placeholder: 'UUID from agency page',
    })
  }
  if (subject.value === 'payee') {
    base.push({
      key: 'payee_id',
      label: 'Payee id',
      type: 'input',
      placeholder: 'UUID from payee page',
    })
  }
  if (subject.value === 'county') {
    base.push({
      key: 'county_id',
      label: 'County id',
      type: 'input',
      placeholder: 'UUID from county page',
    })
  }

  return base
})

function toQueryString(value: FilterValue | undefined) {
  if (value === null || value === undefined || value === '') {
    return
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : undefined
  }

  return String(value)
}

function switchMode(nextMode: string | number) {
  if (typeof nextMode !== 'string') {
    return
  }

  router.replace({
    query: cleanQueryObject({
      ...route.query,
      mode: nextMode,
    }),
  })
}
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Analysis"
      title="Investigation Console"
      subtitle="Deep-dive spending analysis grounded in the explorer's existing data model, with explicit warnings about what the data can and cannot support."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Analysis' }]"
      :badge="dataset === 'payments' ? 'Payment facts' : 'County annual facts'"
    />

    <UAlert
      :title="
        dataset === 'payments'
          ? 'Payment analysis does not carry county geography.'
          : 'County analysis stays inside annual county expenditure totals.'
      "
      :description="
        dataset === 'payments'
          ? 'Use this workspace for agency, payee, category, object, and relationship analysis on state payment facts. It must not be read as county-level transaction geography.'
          : 'Use this workspace for annual county distribution patterns only. It must not be interpreted as geocoded payment rows.'
      "
      icon="i-lucide-shield-alert"
      color="primary"
      variant="soft"
      class="rounded-[1.25rem]"
    />

    <EntityTabs
      :model-value="mode"
      :tabs="tabs"
      persist-key="analysis-mode"
      @update:model-value="switchMode"
    />

    <FilterBar v-model="filters" :available-filters="availableFilters" />

    <UAlert
      v-if="subjectNeedsIdentifier"
      title="This focus needs an entity id."
      description="Open analysis from an agency, payee, or county detail page for a ready-made deep link, or paste the relevant id into the filter bar."
      icon="i-lucide-link"
      color="warning"
      variant="soft"
      class="rounded-[1.25rem]"
    />

    <div v-if="status === 'pending'" class="flex min-h-72 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <div v-else-if="error" class="space-y-4">
      <EmptyState
        title="Analysis unavailable"
        :description="error.message || 'The current combination of filters is not supported.'"
        icon="i-lucide-triangle-alert"
      />
    </div>

    <template v-else-if="meta">
      <section class="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)]">
        <div class="space-y-6">
          <TrendChartCard
            v-if="trendAnalysis?.series.length"
            title="Trend line"
            :description="trendAnalysis.summary"
            :series="trendAnalysis.series[0]?.points || []"
            x-key="fiscal_year"
            y-key="amount"
            :value-formatter="formatUsdCompact"
          />

          <div v-else-if="concentrationAnalysis" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total amount"
              :value="formatUsdCompact(concentrationAnalysis.total_amount)"
              :helper="formatUsd(concentrationAnalysis.total_amount)"
              icon="i-lucide-wallet"
            />
            <KpiCard
              label="Top 5 share"
              :value="formatPct((concentrationAnalysis.top_5_share || 0) * 100)"
              helper="Cumulative share"
              icon="i-lucide-chart-no-axes-column-increasing"
            />
            <KpiCard
              label="HHI"
              :value="(concentrationAnalysis.hhi || 0).toFixed(3)"
              :helper="concentrationAnalysis.interpretation"
              icon="i-lucide-scan-search"
            />
            <KpiCard
              label="Lead share"
              :value="formatPct((concentrationAnalysis.items[0]?.share || 0) * 100)"
              :helper="concentrationAnalysis.items[0]?.label || 'No leading item'"
              icon="i-lucide-crown"
            />
          </div>

          <div v-else-if="outlierAnalysis" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Current FY"
              :value="String(outlierAnalysis.current_fiscal_year || '—')"
              :helper="`Compared with FY ${outlierAnalysis.prior_fiscal_year || '—'}`"
              icon="i-lucide-calendar-range"
            />
            <KpiCard
              label="Biggest increase"
              :value="outlierAnalysis.increases[0]?.label || 'None'"
              :helper="
                outlierAnalysis.increases[0]
                  ? formatUsdCompact(outlierAnalysis.increases[0].delta_amount)
                  : 'No mover met thresholds'
              "
              icon="i-lucide-trending-up"
            />
            <KpiCard
              label="Biggest decrease"
              :value="outlierAnalysis.decreases[0]?.label || 'None'"
              :helper="
                outlierAnalysis.decreases[0]
                  ? formatUsdCompact(Math.abs(outlierAnalysis.decreases[0].delta_amount))
                  : 'No mover met thresholds'
              "
              icon="i-lucide-trending-down"
            />
            <KpiCard
              label="Thresholds"
              :value="formatUsdCompact(minChangeAmount || 1000000)"
              :helper="`${minChangePct || 25}% minimum change`"
              icon="i-lucide-filter"
            />
          </div>

          <div v-else-if="relationshipAnalysis" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Edge count"
              :value="String(relationshipAnalysis.edges.length)"
              helper="Top observed relationships"
              icon="i-lucide-share-2"
            />
            <KpiCard
              label="Strongest edge"
              :value="relationshipAnalysis.edges[0]?.left_label || 'None'"
              :helper="relationshipAnalysis.edges[0]?.right_label || 'No edge returned'"
              icon="i-lucide-network"
            />
            <KpiCard
              label="Edge amount"
              :value="
                relationshipAnalysis.edges[0]
                  ? formatUsdCompact(relationshipAnalysis.edges[0].amount)
                  : '$0'
              "
              :helper="relationshipAnalysis.summary"
              icon="i-lucide-link-2"
            />
            <KpiCard
              label="Scope"
              :value="relationshipLabel"
              helper="Observed payment co-occurrence only"
              icon="i-lucide-clipboard-list"
            />
          </div>

          <UCard v-if="trendAnalysis" class="card-base">
            <template #header>
              <div class="space-y-1">
                <p class="text-lg font-semibold text-default">Trend summary</p>
                <p class="text-sm text-muted">{{ trendAnalysis.summary }}</p>
              </div>
            </template>
            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="seriesRow in trendAnalysis.series"
                :key="seriesRow.id"
                class="rounded-2xl border border-default bg-elevated/50 p-4"
              >
                <p class="text-sm font-semibold text-default">{{ seriesRow.label }}</p>
                <p class="mt-2 text-2xl font-semibold text-default">
                  {{ formatUsdCompact(seriesRow.latest_amount) }}
                </p>
                <p class="mt-2 text-sm text-muted">
                  {{ seriesRow.summary }}
                </p>
              </div>
            </div>
          </UCard>

          <div
            v-if="concentrationAnalysis"
            class="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          >
            <RankedBarCard
              title="Who dominates this slice?"
              :description="concentrationAnalysis.summary"
              :items="concentrationAnalysis.items"
              label-key="label"
              value-key="amount"
              :value-formatter="formatUsdCompact"
            />
            <DataTableCard
              title="Supporting concentration rows"
              description="Amounts, share of total, and cumulative share for the current slice."
              :columns="[
                { key: 'label', label: 'Entity' },
                { key: 'amount', label: 'Amount' },
                { key: 'share', label: 'Share' },
                { key: 'cumulative_share', label: 'Cumulative share' },
              ]"
              :rows="concentrationAnalysis.items"
              :meta="{
                limit: concentrationAnalysis.items.length || 1,
                offset: 0,
                total: concentrationAnalysis.items.length || 0,
              }"
              :loading="false"
              :mobile-cards="false"
            >
              <template #amount-data="{ row }">
                {{ formatUsd(row.amount) }}
              </template>
              <template #share-data="{ row }">
                {{ formatPct(row.share * 100) }}
              </template>
              <template #cumulative_share-data="{ row }">
                {{ formatPct(row.cumulative_share * 100) }}
              </template>
            </DataTableCard>
          </div>

          <div v-if="outlierAnalysis" class="grid gap-6 xl:grid-cols-2">
            <DataTableCard
              title="Largest increases"
              description="Rows that cleared the current outlier thresholds on absolute and percent change."
              :columns="[
                { key: 'label', label: 'Entity' },
                { key: 'delta_amount', label: 'Delta' },
                { key: 'pct_change', label: '% change' },
              ]"
              :rows="outlierAnalysis.increases"
              :meta="{
                limit: outlierAnalysis.increases.length || 1,
                offset: 0,
                total: outlierAnalysis.increases.length || 0,
              }"
              :loading="false"
              :mobile-cards="false"
            >
              <template #delta_amount-data="{ row }">
                {{ formatUsd(row.delta_amount) }}
              </template>
              <template #pct_change-data="{ row }">
                {{ row.pct_change === null ? 'New base' : formatPct(row.pct_change) }}
              </template>
            </DataTableCard>

            <DataTableCard
              title="Largest decreases"
              description="Largest negative deltas under the current thresholds."
              :columns="[
                { key: 'label', label: 'Entity' },
                { key: 'delta_amount', label: 'Delta' },
                { key: 'pct_change', label: '% change' },
              ]"
              :rows="outlierAnalysis.decreases"
              :meta="{
                limit: outlierAnalysis.decreases.length || 1,
                offset: 0,
                total: outlierAnalysis.decreases.length || 0,
              }"
              :loading="false"
              :mobile-cards="false"
            >
              <template #delta_amount-data="{ row }">
                {{ formatUsd(row.delta_amount) }}
              </template>
              <template #pct_change-data="{ row }">
                {{ row.pct_change === null ? 'New base' : formatPct(row.pct_change) }}
              </template>
            </DataTableCard>
          </div>

          <DataTableCard
            v-if="relationshipAnalysis"
            title="Observed relationship edges"
            description="These are ranked payment co-occurrence edges only. They do not identify contracts or procurement certainty."
            :columns="[
              { key: 'left_label', label: 'Left node' },
              { key: 'right_label', label: 'Right node' },
              { key: 'amount', label: 'Amount' },
              { key: 'share_of_left', label: 'Share of left' },
              { key: 'share_of_right', label: 'Share of right' },
            ]"
            :rows="relationshipAnalysis.edges"
            :meta="{
              limit: relationshipAnalysis.edges.length || 1,
              offset: 0,
              total: relationshipAnalysis.edges.length || 0,
            }"
            :loading="false"
            :mobile-cards="false"
          >
            <template #amount-data="{ row }">
              {{ formatUsd(row.amount) }}
            </template>
            <template #share_of_left-data="{ row }">
              {{ formatPct(row.share_of_left * 100) }}
            </template>
            <template #share_of_right-data="{ row }">
              {{ formatPct(row.share_of_right * 100) }}
            </template>
          </DataTableCard>
        </div>

        <div class="space-y-6">
          <UCard class="card-base">
            <template #header>
              <div class="space-y-1">
                <p class="text-lg font-semibold text-default">Methodology</p>
                <p class="text-sm text-muted">
                  {{ meta.subject_label }} ·
                  {{ meta.dataset === 'payments' ? 'Payment facts' : 'County annual facts' }}
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Dataset</p>
                <p class="mt-2 text-sm text-default">
                  {{
                    meta.dataset === 'payments'
                      ? 'Transactional state payment facts and rollups'
                      : 'Annual county expenditure facts'
                  }}
                </p>
              </div>

              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  What this can support
                </p>
                <ul class="mt-2 space-y-2 text-sm leading-6 text-muted">
                  <li v-for="note in meta.methodology" :key="note">• {{ note }}</li>
                </ul>
              </div>

              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Warnings</p>
                <ul class="mt-2 space-y-2 text-sm leading-6 text-muted">
                  <li v-for="warning in meta.warnings" :key="warning">• {{ warning }}</li>
                </ul>
              </div>
            </div>
          </UCard>

          <UCard class="card-base">
            <template #header>
              <div class="space-y-1">
                <p class="text-lg font-semibold text-default">Active State</p>
                <p class="text-sm text-muted">
                  This page is fully URL-driven so the current slice can be shared directly.
                </p>
              </div>
            </template>
            <dl class="grid gap-3 text-sm text-muted">
              <div class="flex items-start justify-between gap-4">
                <dt class="font-medium text-default">Mode</dt>
                <dd>{{ mode }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="font-medium text-default">Dataset</dt>
                <dd>{{ dataset }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="font-medium text-default">Subject</dt>
                <dd>{{ meta.subject_label }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="font-medium text-default">Breakdown</dt>
                <dd>{{ activeBreakdown }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="font-medium text-default">Drill path</dt>
                <dd>
                  {{
                    meta.drill_path === 'transactions'
                      ? 'Transaction detail'
                      : 'County annual detail'
                  }}
                </dd>
              </div>
              <div v-if="comparisonYears" class="flex items-start justify-between gap-4">
                <dt class="font-medium text-default">Comparison window</dt>
                <dd>FY {{ comparisonYears.prior }} → FY {{ comparisonYears.current }}</dd>
              </div>
            </dl>
          </UCard>
        </div>
      </section>
    </template>
  </UContainer>
</template>
