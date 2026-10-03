import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// `vercel env pull` writes DATABASE_URL to .env.local
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' }
});
