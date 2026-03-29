import { sqliteTable, integer, text, customType } from "drizzle-orm/sqlite-core";

const sqliteVecBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'blob';
  },
  toDriver(val: Buffer): Buffer {
    return val;
  },
  fromDriver(val: unknown): Buffer {
    return val as Buffer;
  },
});

export const memoryEmbeddingsTable = sqliteTable('memory_embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  embeddingId: text('embedding_id').notNull().unique(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  groupId: text('group_id').notNull(),
  chunkIndex: integer('chunk_index').notNull().default(0),
  chunkText: text('chunk_text').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  embedding: sqliteVecBlob('embedding').notNull(),
  dimension: integer('dimension').notNull(),
  modelId: text('model_id').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  sourceCreatedAt: integer('source_created_at', { mode: 'timestamp' })
});
