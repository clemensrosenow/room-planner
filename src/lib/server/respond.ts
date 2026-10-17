import { json } from '@sveltejs/kit';
import { HttpFail } from './designs';

/** Runs an endpoint; expected failures become `{ message }` JSON with their status. */
export async function respond(fn: () => Promise<unknown>, status = 200): Promise<Response> {
	try {
		return json(await fn(), { status, headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		if (e instanceof HttpFail)
			return json({ message: e.message, ...e.extra }, { status: e.status });
		console.error(e);
		return json(
			{ message: 'Something went wrong on our side. Please try again.' },
			{ status: 500 }
		);
	}
}
