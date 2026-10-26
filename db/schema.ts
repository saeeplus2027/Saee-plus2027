import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const siteContent = sqliteTable('site_content', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  payload: text('payload').notNull(),
  updatedBy: text('updated_by').notNull(),
});

// A row is keyed by the hosting platform's verified user ID. The browser never submits this owner ID.
export const skillPassports = sqliteTable('skill_passports', {
  userId: text('user_id').primaryKey().notNull(),
  payload: text('payload').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
