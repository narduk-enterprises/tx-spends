import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: [
    // '../../layers/narduk-nuxt-layer/server/database/pg-schema.ts',
    './server/database/app-schema.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
})
