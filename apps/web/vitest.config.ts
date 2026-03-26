import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Server-only unit tests that run without Nuxt build context
    include: ['tests/server/**/*.test.ts'],
    tsconfig: './tsconfig.test.json',
  },
})
