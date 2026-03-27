import type { MaybeRefOrGetter } from 'vue'
import type { CountyMapMetric, CountyMapQuery } from '~/utils/county-map'
import { buildFetchKey, cleanQueryObject } from '~/utils/explorer'

interface UseCountyMapOptions {
  key?: MaybeRefOrGetter<string | undefined>
}

function readOptionValue<T>(value: MaybeRefOrGetter<T> | undefined): T | undefined {
  if (typeof value === 'function') {
    return (value as () => T)()
  }

  return unref(value)
}

export async function useCountyMap(
  query: MaybeRefOrGetter<CountyMapQuery | undefined>,
  options: UseCountyMapOptions = {},
) {
  const countyMapQuery = computed(() => {
    const resolvedQuery = readOptionValue(query) || {}

    return cleanQueryObject({
      fiscal_year: resolvedQuery.fiscal_year ?? undefined,
      q: resolvedQuery.q || undefined,
      agency_id: resolvedQuery.agency_id || undefined,
      category_code: resolvedQuery.category_code || undefined,
      sort: 'amount',
      order: 'desc',
    })
  })

  const countyMapKey = computed(
    () => readOptionValue(options.key) ?? buildFetchKey('county-map', countyMapQuery.value),
  )

  const { data, error, refresh, status } = await useLazyFetch('/api/v1/county-map', {
    key: countyMapKey,
    query: countyMapQuery,
    default: () => ({
      data: [] as CountyMapMetric[],
    }),
  })

  const countyMetrics = computed(() => (data.value?.data || []) as CountyMapMetric[])

  return {
    countyMapError: error,
    countyMapQuery,
    countyMapStatus: status,
    countyMetrics,
    refreshCountyMap: refresh,
  }
}
