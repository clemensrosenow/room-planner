const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** "Cozy Nook by the Window" → "cozy-nook-by-the-window". Only for looks: the id decides. */
export function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[äöüß]/g, (c) => UMLAUTS[c])
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 40)
		.replace(/^-+|-+$/g, '');
}

/** Canonical path of a Published Design: /d/<id>-<slug> (just /d/<id> without a slug). */
export function designPath(d: { id: string; title: string }) {
	const slug = slugify(d.title);
	return `/d/${d.id}${slug ? '-' + slug : ''}`;
}
