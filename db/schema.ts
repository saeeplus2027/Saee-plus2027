import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const siteContent = sqliteTable('site_content', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  payload: text('payload').notNull(),
  updatedBy: text('updated_by').notNull(),
});
