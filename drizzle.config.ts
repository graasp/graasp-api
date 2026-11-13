import 'dotenv/config';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'drizzle-kit';

// The database schema is owned by the admin app (graasp/graasp-web): it writes and
// runs the migrations, and schema.ts describes the result. Do not run
// `drizzle-kit generate`, `migrate` or `push`: push would drop the admin-only tables.
export default defineConfig({
  dialect: 'postgresql',
  out: './src/drizzle',
  schema: './src/drizzle/schema.ts',
  dbCredentials: {
    url: process.env.DB_CONNECTION!,
  },
  // Print all statements
  verbose: process.env.DATABASE_LOGS === 'true',
  // Always ask for confirmation
  strict: true,
});
