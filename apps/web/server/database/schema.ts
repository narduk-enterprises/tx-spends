/**
 * Combined runtime database schema.
 *
 * Re-exports the layer's PostgreSQL schema (pg-schema.ts) instead of the
 * SQLite schema. This app runs with NUXT_DATABASE_BACKEND=postgres.
 * App-owned Drizzle migrations are generated from the layer's pg-schema.ts
 * plus app-schema.ts.
 */
export * from '#layer/server/database/pg-schema'
export * from '#server/database/auth-bridge-schema'
export * from '#server/database/app-schema'
