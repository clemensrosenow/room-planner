/**
 * Checks Likes and the Leaderboard against a running dev server (`npm run dev`).
 * Run: npx tsx scripts/test-leaderboard.ts [http://localhost:5173]
 *
 * It publishes test designs into the database behind that server and deletes them at the end,
 * so point it at a development database, not production.
 */
import { defaultPlacements } from '../src/lib/planner/room';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const RUN = Date.now().toString(36);
let failed = 0;

function check(ok: boolean, label: string, detail?: unknown) {
	if (!ok) failed++;
	console.log(ok ? 'ok  ' : 'FAIL', label, ok || detail === undefined ? '' : detail);
}

async function call(method: string, path: string, device: string, body?: unknown) {
	const res = await fetch(BASE + path, {
		method,
		headers: {
			accept: 'application/json',
			'x-device-id': device,
			...(body !== undefined && { 'content-type': 'application/json' })
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	return { status: res.status, body: await res.json().catch(() => null) };
}

const owner = (i: number) => `test-${RUN}-owner-${i}`;
const liker = (i: number) => `test-${RUN}-liker-${i}`;
const created: { id: string; device: string }[] = [];

try {
	// 30 designs, so the Leaderboard needs two pages; design i gets i % 4 Likes
	for (let i = 0; i < 30; i++) {
		const res = await call('POST', '/api/designs', owner(i), {
			title: `Test ${RUN} #${i}`,
			placements: defaultPlacements()
		});
		if (res.status !== 200) throw new Error(`Publishing failed: ${JSON.stringify(res.body)}`);
		created.push({ id: res.body.id, device: owner(i) });
	}
	const [first] = created;

	/* ---------- Likes ---------- */
	let r = await call('PUT', `/api/designs/${first.id}/like`, liker(0));
	check(r.status === 200 && r.body?.likeCount === 1, 'like → 1', r);
	r = await call('PUT', `/api/designs/${first.id}/like`, liker(0));
	check(r.body?.likeCount === 1, 'liking again changes nothing', r.body);
	r = await call('PUT', `/api/designs/${first.id}/like`, liker(1));
	check(r.body?.likeCount === 2, 'second device → 2', r.body);
	r = await call('GET', `/api/designs/${first.id}`, liker(0));
	check(r.body?.likedByMe === true && r.body?.likeCount === 2, 'likedByMe and count', r.body);
	r = await call('DELETE', `/api/designs/${first.id}/like`, liker(0));
	check(r.body?.likeCount === 1, 'unlike → 1', r.body);
	r = await call('DELETE', `/api/designs/${first.id}/like`, liker(0));
	check(r.body?.likeCount === 1, 'unliking again changes nothing', r.body);
	r = await call('PUT', `/api/designs/${first.id}/like`, first.device);
	check(r.status === 403, 'own design → 403', r);
	r = await call('PUT', '/api/designs/zzzzzzzz/like', liker(0));
	check(r.status === 404, 'unknown design → 404', r);

	// Ten devices at once: the count must end at exactly 10
	const crowd = created[1];
	await Promise.all(
		Array.from({ length: 10 }, (_, i) => call('PUT', `/api/designs/${crowd.id}/like`, liker(i)))
	);
	r = await call('GET', `/api/designs/${crowd.id}`, liker(0));
	check(r.body?.likeCount === 10, 'ten simultaneous Likes → 10', r.body?.likeCount);
	await Promise.all(
		Array.from({ length: 10 }, (_, i) => call('DELETE', `/api/designs/${crowd.id}/like`, liker(i)))
	);

	// Reset the first design, then give design i exactly i % 4 Likes
	await call('DELETE', `/api/designs/${first.id}/like`, liker(1));
	for (const [i, d] of created.entries())
		for (let j = 0; j < i % 4; j++) await call('PUT', `/api/designs/${d.id}/like`, liker(j));

	/* ---------- Leaderboard ---------- */
	for (const sort of ['top', 'new'] as const) {
		const seen: { id: string; likeCount: number; createdAt: string }[] = [];
		let cursor: string | null = null;
		let pages = 0;
		do {
			const query: string = `?sort=${sort}${cursor ? `&cursor=${cursor}` : ''}`;
			r = await call('GET', `/api/designs${query}`, liker(0));
			if (r.status !== 200) throw new Error(`${sort}: ${r.status} ${JSON.stringify(r.body)}`);
			check(r.body.designs.length <= 24, `${sort}: page ${pages + 1} has at most 24`);
			seen.push(...r.body.designs);
			cursor = r.body.nextCursor;
			pages++;
		} while (cursor && pages < 100);

		const ids = seen.map((d) => d.id);
		check(new Set(ids).size === ids.length, `${sort}: no design twice`);
		check(
			created.every((c) => ids.includes(c.id)),
			`${sort}: every design appears (${pages} pages)`
		);
		const inOrder = seen.every((d, i) => {
			if (i === 0) return true;
			const prev = seen[i - 1];
			if (sort === 'top' && prev.likeCount !== d.likeCount) return prev.likeCount > d.likeCount;
			return prev.createdAt >= d.createdAt;
		});
		check(inOrder, `${sort}: sorted`);
		const mine = seen.find((d) => d.id === created[1].id) as { likedByMe?: boolean } | undefined;
		check(mine?.likedByMe === true, `${sort}: likedByMe in the list`);
	}
	r = await call('GET', '/api/designs?cursor=garbage', liker(0));
	check(r.status === 400, 'invalid cursor → 400', r.status);
} catch (e) {
	failed++;
	console.log('FAIL', (e as Error).message);
} finally {
	// Deleting a design removes its Likes too
	for (const d of created) await call('DELETE', `/api/designs/${d.id}`, d.device);
	console.log(`Cleaned up ${created.length} test designs.`);
}

console.log(failed ? `${failed} failed` : 'All passed');
process.exitCode = failed ? 1 : 0;
