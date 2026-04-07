<script setup lang="ts">
import { buildFetchKey, formatUsd, formatUsdCompact } from '~/utils/explorer'

const route = useRoute()
const router = useRouter()
const objectCode = computed(() => String(route.params.code))

const backBreadcrumb = ref({ label: 'Objects', to: '/objects' })

onMounted(() => {
  const back = router.options.history.state.back
  if (typeof back === 'string' && back !== '/') {
    const splitPath = back.split('?')[0] ?? ''
    const segment = splitPath.split('/')[1]
    const label = segment
      ? segment.charAt(0).toUpperCase() + segment.slice(1).replaceAll('-', ' ')
      : 'Back'
    backBreadcrumb.value = { label, to: back }
  }
})

const detailKey = computed(() => buildFetchKey(`object-detail:${objectCode.value}`))

const { data: detail, status } = await useLazyFetch(() => `/api/v1/objects/${objectCode.value}`, {
  key: detailKey,
})

const objectDetail = computed(() => detail.value?.data)

const title = computed(() =>
  objectDetail.value
    ? `${objectDetail.value.object_title} (${objectDetail.value.object_code})`
    : 'Comptroller Object Detail',
)
const description = computed(() =>
  objectDetail.value
    ? `Explore total spend and referential details for comptroller object ${objectDetail.value.object_code}.`
    : 'Explore a comptroller object.',
)

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-badge-dollar-sign',
  },
})

useWebPageSchema({
  name: title,
  description,
  type: 'ItemPage',
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="objectDetail">
      <PageHeader
        eyebrow="Object detail"
        :title="objectDetail.object_title"
        :subtitle="
          objectDetail.category_title ||
          objectDetail.object_group ||
          'Comptroller object detail from the state payment feed.'
        "
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          backBreadcrumb,
          { label: objectDetail.object_code },
        ]"
        :badge="objectDetail.object_code"
      >
        <template #actions>
          <UButton
            :to="`https://comptroller.texas.gov/open-search/?q=${objectDetail.object_code}`"
            target="_blank"
            color="neutral"
            variant="outline"
            icon="i-lucide-external-link"
            class="rounded-full"
          >
            Official reference
          </UButton>
        </template>
      </PageHeader>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total spend"
          :value="formatUsdCompact(objectDetail.total_spend)"
          :helper="formatUsd(objectDetail.total_spend)"
          icon="i-lucide-wallet"
        />
        <KpiCard
          label="Object code"
          :value="objectDetail.object_code"
          helper="Fine-grained accounting object"
          icon="i-lucide-hash"
        />
        <KpiCard
          label="Category"
          :value="objectDetail.category_title || objectDetail.object_group || 'Unlisted'"
          helper="Parent expenditure bucket"
          icon="i-lucide-layers-3"
        />
      </section>
    </template>

    <EmptyState
      v-else
      title="Object not found"
      description="The requested comptroller object could not be found."
      icon="i-lucide-search-x"
    >
      <UButton to="/objects" color="primary" variant="soft" class="rounded-full">
        Back to objects
      </UButton>
    </EmptyState>
  </UContainer>
</template>
