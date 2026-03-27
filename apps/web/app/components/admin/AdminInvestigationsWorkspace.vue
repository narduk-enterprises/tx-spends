<script setup lang="ts">
const route = useRoute()
const adminInvestigations = useAdminInvestigationTopics()

const routeTopicId = computed(() => {
  const raw = route.params.topicId
  return typeof raw === 'string' ? raw : null
})

watch(
  routeTopicId,
  (topicId) => {
    adminInvestigations.selectTopic(topicId)
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
    <AdminInvestigationTopicsList
      :topics="adminInvestigations.topics.value"
      :loading="adminInvestigations.topicsStatus.value === 'pending'"
      :selected-topic-id="adminInvestigations.selectedTopicId.value"
    />

    <AdminInvestigationTopicEditor
      v-model="adminInvestigations.editorState.value"
      :topic="adminInvestigations.selectedTopic.value"
      :loading="adminInvestigations.selectedTopicStatus.value === 'pending'"
      :dirty="adminInvestigations.isDirty.value"
      :saving="adminInvestigations.isSaving.value"
      @refresh="adminInvestigations.refreshSelectedTopic()"
      @reset="adminInvestigations.resetEditor()"
      @save="adminInvestigations.saveCurrentTopic()"
    />
  </div>
</template>
