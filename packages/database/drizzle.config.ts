import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: '../../apps/desktop/resources/database/drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // Local file representation for drizzle-kit
    url: process.env.DB_PATH ? `file:${process.env.DB_PATH}` : 'file:./local.db'
  }
});
