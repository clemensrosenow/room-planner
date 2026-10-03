import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Neon Postgres connection string, set by the Vercel Neon integration',
		// Optional at start, so pages without the database still work; the API reports it missing
		schema: (value) => value || undefined
	}
});
