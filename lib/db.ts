import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  primaryKey,
  index
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel, eq } from 'drizzle-orm';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
if (!connectionString) {
  console.warn('POSTGRES_URL is not set. Database functions will fail until configured.');
}
export const client = postgres(connectionString, { ssl: 'require', max: 1 });
export const db = drizzle(client);

export const roleEnum = pgEnum('role', ['admin', 'editor', 'viewer']);
export const statusEnum = pgEnum('song_status', ['draft', 'in_progress', 'mixing', 'mastering', 'done']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const songs = pgTable('songs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  bpm: integer('bpm'),
  key: text('key'),
  status: statusEnum('status').notNull().default('draft'),
  previewUrl: text('preview_url'),
  audioUrl: text('audio_url'),
  waveformJson: jsonb('waveform_json').$type<{ peaks: number[]; duration: number } | null>(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  titleIdx: index('songs_title_idx').on(table.title),
  statusIdx: index('songs_status_idx').on(table.status),
}));

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  color: text('color').notNull(),
  description: text('description'),
});

export const songTags = pgTable('song_tags', {
  songId: uuid('song_id').references(() => songs.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.songId, table.tagId] }),
  songIdx: index('song_tags_song_idx').on(table.songId),
  tagIdx: index('song_tags_tag_idx').on(table.tagId),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  songsCreated: many(songs),
}));

export const songsRelations = relations(songs, ({ many }) => ({
  tags: many(songTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  songs: many(songTags),
}));

export const songTagsRelations = relations(songTags, ({ one }) => ({
  song: one(songs, { fields: [songTags.songId], references: [songs.id] }),
  tag: one(tags, { fields: [songTags.tagId], references: [tags.id] }),
}));

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Song = InferSelectModel<typeof songs>;
export type NewSong = InferInsertModel<typeof songs>;
export type Tag = InferSelectModel<typeof tags>;
export type NewTag = InferInsertModel<typeof tags>;
export type AuditLog = InferSelectModel<typeof auditLogs>;

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function logAudit(params: { userId?: string; entityType: string; entityId: string; action: string }) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId as string | undefined,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
    });
  } catch (e) {
    // swallow logging errors to avoid breaking main flow
  }
}


