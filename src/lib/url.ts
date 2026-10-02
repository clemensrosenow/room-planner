import { goto } from '$app/navigation';
import { page } from '$app/state';

/** The app's three steps, in order. */
export const STEPS = [
	{ path: '/room', label: 'Shape' },
	{ path: '/furnish', label: 'Furnish' },
	{ path: '/experience', label: 'Experience' }
] as const;

export type Params = Record<string, string | number | boolean | null | undefined>;

/**
 * Changes query params of the current page without scrolling or remounting it.
 * `null`, `undefined`, `false` and `''` remove a param.
 */
export function setParams(params: Params, opts: { replace?: boolean; state?: App.PageState } = {}) {
	const url = new URL(page.url.href);
	for (const [key, value] of Object.entries(params)) {
		if (value == null || value === false || value === '') url.searchParams.delete(key);
		else url.searchParams.set(key, String(value));
	}
	if (url.href === page.url.href) return Promise.resolve();
	return goto(url, { replace: opts.replace, reset: false, state: opts.state ?? page.state });
}

/**
 * Selects a piece on the furnish page via `?item=`. Selecting from nothing adds a history entry
 * (so Back deselects), switching pieces replaces it, deselecting goes back to the entry before.
 */
export function selectItem(id: string | null) {
	const current = page.url.searchParams.get('item');
	if (current === id) return;
	if (id === null && page.state.selectionPushed) {
		history.back();
		return;
	}
	if (current === null) return setParams({ item: id }, { state: { selectionPushed: true } });
	return setParams({ item: id }, { replace: true });
}
