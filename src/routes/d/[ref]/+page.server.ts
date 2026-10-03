import { error, redirect } from '@sveltejs/kit';
import { getDesign } from '#lib/server/designs.ts';
import { designPath } from '#lib/social/slug.ts';
import type { PageServerLoad } from './$types';

// Rendered on the server, so shared links unfurl with title and description
export const ssr = true;
export const prerender = false;

/** /d/<id>-<slug>: the id decides, a wrong or missing slug redirects to the canonical one. */
export const load: PageServerLoad = async ({ params, url, setHeaders, untrack }) => {
	const design = await getDesign(params.ref.split('-')[0], null);
	if (!design) error(404, 'Design not found');
	const path = designPath(design);
	// Query params (view, shot, time) only change the view: they must not reload the design
	if (url.pathname !== path) redirect(301, path + untrack(() => url.search));
	setHeaders({ 'x-robots-tag': 'noindex' });
	return { design };
};
