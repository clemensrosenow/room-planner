import { DATABASE_URL } from '$app/env/private';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let instance: ReturnType<typeof connect> | undefined;

function connect() {
	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
	return drizzle(neon(DATABASE_URL), { schema });
}

/** Neon over HTTP: no connection pool to manage in serverless functions. Created on first use. */
export function db() {
	return (instance ??= connect());
}
