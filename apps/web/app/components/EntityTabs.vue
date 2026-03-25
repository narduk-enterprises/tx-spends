<script setup lang="ts">
const props = defineProps<{
  tabs: {
    label: string
    key: string
    icon?: string
    disabled?: boolean
  }[]
  modelValue: string
  persistKey?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const items = computed(() =>
  props.tabs.map((tab) => ({
    label: tab.label,
    value: tab.key,
    icon: tab.icon,
    disabled: tab.disabled,
  })),
)

function handleUpdate(value: string | number | undefined) {
  if (value === undefined) {
    return
  }

  emit('update:modelValue', value)
}
</script>

<template>
  <AppTabs
    :items="items"
    :model-value="modelValue"
    :persist-key="persistKey"
    variant="pill"
    color="primary"
    class="mt-6 mb-8"
    @update:model-value="handleUpdate"
  />
</template>
