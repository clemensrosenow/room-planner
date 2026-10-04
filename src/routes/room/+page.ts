import { redirect } from '@sveltejs/kit';

// The Room is fixed (ADR 0002), so the Shape step is gone
export function load() {
	redirect(308, '/furnish');
}
