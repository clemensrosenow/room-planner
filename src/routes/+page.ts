import { redirect } from '@sveltejs/kit';
import { loadStep } from '#lib/planner/storage.ts';

// The start page only forwards to the last visited step (or the first one)
export function load() {
	redirect(307, loadStep());
}
