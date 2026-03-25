/**
 * App-owned database schema (PostgreSQL).
 *
 * drizzle-kit generates apps/web/drizzle/*.sql from this file plus
 * pg-schema.ts.
 *
 * Example:
 *
 * import { serial, pgTable, text } from 'drizzle-orm/pg-core'
 * import { users } from './pg-schema'
 *
 * export const posts = pgTable('posts', {
 *   id: serial('id').primaryKey(),
 *   authorId: text('author_id')
 *     .notNull()
 *     .references(() => users.id, { onDelete: 'cascade' }),
 *   title: text('title').notNull(),
 * })
 */
export {}
