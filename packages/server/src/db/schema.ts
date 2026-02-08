import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// =====================================
// ITEMS — Example Entity
// Replace with your own domain entity.
// =====================================

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),

  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'), // todo | doing | done

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
