<script setup lang="ts">
const adminInvestigations = useAdminInvestigationTopics()
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <UCard class="card-base border-default">
        <div class="space-y-4">
          <div class="space-y-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">
              Investigations
            </p>
            <h2 class="text-lg font-semibold text-default">Private research backlog</h2>
            <p class="text-sm text-muted">
              Manage the seeded sleuthing dossiers separately from the public spotlight blog and
              keep the reporting workflow private.
            </p>
          </div>

          <UButton to="/admin/investigations" color="primary" icon="i-lucide-search-code">
            Open investigations workspace
          </UButton>
        </div>
      </UCard>

      <UCard class="card-base border-default">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Backlog</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminInvestigations.statusCounts.value.backlog }}
            </p>
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Reporting</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminInvestigations.statusCounts.value.reporting }}
            </p>
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Drafting</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminInvestigations.statusCounts.value.drafting }}
            </p>
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Published</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminInvestigations.statusCounts.value.published }}
            </p>
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Parked</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminInvestigations.statusCounts.value.parked }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <AdminInvestigationTopicsList
      :topics="adminInvestigations.topics.value"
      :loading="adminInvestigations.topicsStatus.value === 'pending'"
      :selected-topic-id="adminInvestigations.selectedTopicId.value"
    />
  </div>
</template>
