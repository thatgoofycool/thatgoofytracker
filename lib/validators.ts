import { z } from 'zod';

const title = z.string().min(1).max(120).trim();
const description = z.string().max(2000).trim().optional().nullable();
const slug = z.string().min(1).max(140).regex(/^[a-z0-9-]+$/);
const status = z.enum(['draft', 'in_progress', 'mixing', 'mastering', 'done']);
const uuid = z.string().uuid();

export const paginationQuerySchema = z.object({
  q: z.string().max(100).optional(),
  status: status.optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(10),
});

export const songCreateSchema = z.object({
  title,
  description,
  bpm: z.coerce.number().int().min(30).max(300).optional().nullable(),
  key: z.string().max(8).optional().nullable(),
  status: status.default('draft'),
  slug,
});

export const songUpdateSchema = songCreateSchema.partial().extend({ id: uuid });

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(40),
  slug,
  color: z.enum(['emerald', 'violet', 'cyan', 'amber', 'slate', 'sky']),
  description,
});

export const assignTagsSchema = z.object({
  songId: uuid,
  tagIds: z.array(uuid).min(0),
});

export const uploadRequestSchema = z.object({
  songId: uuid,
  fileName: z.string().min(3).max(200),
  contentType: z.enum(['audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a']),
  fileSize: z.number().int().positive().max(200 * 1024 * 1024),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;


