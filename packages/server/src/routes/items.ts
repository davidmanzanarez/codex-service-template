import { Hono } from 'hono';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { getUser } from '../middleware/auth.js';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const app = new Hono();

// List items (with optional status filter)
app.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const status = c.req.query('status');

  const conditions = [eq(items.userId, user.id)];
  if (status) {
    conditions.push(eq(items.status, status));
  }

  const results = await db.select()
    .from(items)
    .where(and(...conditions))
    .orderBy(desc(items.createdAt));

  return c.json({ items: results });
});

// Create item
app.post('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  if (!body.title) {
    return c.json({ error: 'Title is required' }, 400);
  }

  const now = Date.now();
  const item = {
    id: randomUUID(),
    userId: user.id,
    title: body.title,
    description: body.description || null,
    status: body.status || 'todo',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(items).values(item);
  return c.json({ item }, 201);
});

// Update item
app.patch('/:id', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db.select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.userId, user.id)))
    .limit(1);

  if (!existing.length) return c.json({ error: 'Not found' }, 404);

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(items).set(updates).where(eq(items.id, id));

  const updated = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return c.json({ item: updated[0] });
});

// Delete item
app.delete('/:id', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  await db.delete(items)
    .where(and(eq(items.id, c.req.param('id')), eq(items.userId, user.id)));

  return c.json({ deleted: true });
});

export default app;
