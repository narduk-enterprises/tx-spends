<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tabs: {
    label: string
    key: string
    icon?: string
    disabled?: boolean
  }[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const nuxtUiItems = computed(() => {
  return props.tabs.map((tab) => ({
    label: tab.label,
    value: tab.key,
    icon: tab.icon,
    disabled: tab.disabled,
  }))
})
</script>

<template>
  <UTabs
    :items="nuxtUiItems"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event as string)"
    class="w-full mt-6 mb-8"
  />
</template>
