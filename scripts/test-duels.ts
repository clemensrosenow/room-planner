/**
 * Checks Duels and the Leaderboard against a running dev server (`npm run dev`), per
 * docs/specs/duels.md R3. Run: npm run test:duels (BASE_URL defaults to http://localhost:5174).
 *
 * It WRITES DATA: it publishes test Designs from three Devices, casts Duels on them and deletes
 * everything at the end (Duels go with their Designs). Only run it against a dev server whose
 * DATABASE_URL is the Neon `dev` branch, never production. It only ever votes on its own test
 * Designs, so nothing it does touches anyone else's standings.
 */
import { conflictIds, designFurniture, type Placements } from '../src/lib/planner/room';

const BASE = (process.env.BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '');
const RUN = Date.now().toString(36);
let failed = 0;

/** A Design with no Conflicts, so the server accepts it. */
const PLACEMENTS: Placements = {
	bed: { cx: 153, cy: 307, rot: 270 },
	wardrobe: { cx: 318, cy: 310, rot: 90 },
	desk: { cx: 326, cy: 163, rot: 270 },
	chair: { cx: 140, cy: 177, rot: 90 },
	workstation: { cx: 240, cy: 145, rot: 270 },
	piano: { cx: 71, cy: 427, rot: 180 },
	flipchart: { cx: 307, cy: 420, rot: 90 },
	kallax: { cx: 242, cy: 473, rot: 90 },
	nightstand: { cx: 328, cy: 60, rot: 90 },
	'nymo-lamp': { cx: 214, cy: 354, rot: 0 },
	'floor-lamp': { cx: 217, cy: 30, rot: 0 }
};

/** Stops the run: something the rest of the checks need isn't there. */
class Stop extends Error {}

function check(ok: boolean, label: string, detail?: unknown) {
	if (!ok) failed++;
	console.log(
		ok ? 'ok  ' : 'FAIL',
		label,
		ok || detail === undefined ? '' : JSON.stringify(detail)
	);
}

interface Reply {
	status: number;
	body: any;
	json: boolean;
}

async function call(
	method: string,
	path: string,
	device: string | null,
	body?: unknown
): Promise<Reply> {
	let res: Response;
	try {
		res = await fetch(BASE + path, {
			method,
			headers: {
				accept: 'application/json',
				...(device && { 'x-device-id': device }),
				...(body !== undefined && { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
		});
	} catch (e) {
		throw new Stop(
			`No server at ${BASE} (${(e as Error).cause ?? e}). Start one with: npm run dev -- --port 5174`
		);
	}
	const text = await res.text();
	try {
		return { status: res.status, body: JSON.parse(text), json: true };
	} catch {
		return { status: res.status, body: text.slice(0, 200), json: false };
	}
}

/**
 * Stops with a clear message when an endpoint isn't there yet: SvelteKit answers a missing
 * route with a 404/405 page that isn't our `{ message }` JSON, and an unwritten function with 501.
 */
function requireEndpoint(r: Reply, endpoint: string, where: string) {
	if (r.status === 501)
		throw new Stop(
			`${endpoint} answers 501 Not Implemented: ${r.body?.message ?? ''} → write it in ${where}.`
		);
	if ((r.status === 404 || r.status === 405) && !(r.json && r.body?.message))
		throw new Stop(`${endpoint} doesn't exist yet (${r.status}) → add it in ${where}.`);
	if (r.status >= 500)
		throw new Stop(
			`${endpoint} failed with ${r.status}: ${JSON.stringify(r.body)}. See the dev server log.`
		);
}

const publisher = (i: number) => `test-${RUN}-publisher-${i}`;
const voter = (i: number) => `test-${RUN}-voter-${i}`;
const created: { id: string; device: string }[] = [];
/** Decided Duels that got a 201, for the expected W–L. */
const decided: { winner: string; loser: string }[] = [];

async function vote(device: string, a: string, b: string, winner: string | null) {
	const r = await call('POST', '/api/duels', device, { a, b, winner });
	if (r.status === 201 && winner) decided.push({ winner, loser: winner === a ? b : a });
	return r;
}

interface Row {
	id: string;
	rank: number;
	wins: number;
	losses: number;
	provisional: boolean;
	createdAt: string;
}

async function leaderboard(sort: 'top' | 'new'): Promise<Row[]> {
	const r = await call('GET', `/api/designs?sort=${sort}`, voter(0));
	requireEndpoint(r, `GET /api/designs?sort=${sort}`, 'listDesigns (src/lib/server/designs.ts)');
	const rows = Array.isArray(r.body) ? r.body : r.body?.designs;
	if (r.status !== 200 || !Array.isArray(rows))
		throw new Stop(
			`GET /api/designs?sort=${sort}: expected 200 with a list of Designs, got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`
		);
	return rows;
}

/** Spec R3: W–L counts decided Duels only (no Skips, no prior); provisional = W + L < 5. */
function checkStandings(rows: Row[], designs: string[], label: string) {
	const byId = new Map(rows.map((d) => [d.id, d]));
	check(
		rows.every((d, i) => d.rank === i + 1),
		`${label}: Top is ordered by rank, 1, 2, 3, … with no gaps`,
		rows.map((d) => d.rank).slice(0, 20)
	);
	for (const id of designs) {
		const d = byId.get(id);
		if (!d) {
			check(false, `${label}: ${id} is on the Leaderboard`);
			continue;
		}
		const wins = decided.filter((x) => x.winner === id).length;
		const losses = decided.filter((x) => x.loser === id).length;
		check(
			d.wins === wins && d.losses === losses,
			`${label}: ${id} is ${wins}–${losses} (decided Duels only: no Skips, no prior)`,
			{ wins: d.wins, losses: d.losses }
		);
		check(
			d.provisional === wins + losses < 5,
			`${label}: ${id} provisional = ${wins + losses < 5} (W + L < 5)`,
			d.provisional
		);
	}
}

try {
	if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE))
		throw new Stop(
			`BASE_URL ${BASE} isn't a local dev server. This script writes data; run it only against npm run dev on the Neon dev branch.`
		);
	if (conflictIds(designFurniture(PLACEMENTS)).length)
		throw new Stop(
			'PLACEMENTS has Conflicts with the current ROOM/INVENTORY: update it in this script.'
		);
	console.log(`Testing Duels against ${BASE} (run ${RUN})`);

	/* ---------- Publish: publisher 0 has two Designs, 1 and 2 one each ---------- */
	for (const [i, device] of [publisher(0), publisher(0), publisher(1), publisher(2)].entries()) {
		const r = await call('POST', '/api/designs', device, {
			title: `Duel test ${RUN} #${i}`,
			placements: PLACEMENTS
		});
		if (r.status !== 200)
			throw new Stop(
				`Publishing failed: ${r.status} ${JSON.stringify(r.body)}.` +
					(r.status >= 500
						? ' See the dev server log. Is the server on a branch whose schema matches the database (the Duels migration drops like_count)?'
						: '')
			);
		created.push({ id: r.body.id, device });
	}
	const [d0, d1, d2, d3] = created.map((c) => c.id);
	const mine = (device: string) => created.filter((c) => c.device === device).map((c) => c.id);
	console.log(`Published ${created.length} Designs: ${created.map((c) => c.id).join(', ')}`);

	/* ---------- GET /api/duel ---------- */
	let r = await call('GET', '/api/duel', publisher(0));
	requireEndpoint(
		r,
		'GET /api/duel',
		'src/routes/api/duel/+server.ts (nextPair: src/lib/duels/next-pair.ts)'
	);
	check(r.status === 200 && r.json && 'pair' in r.body, 'GET /api/duel → 200 { pair }', r);
	const pairOk = (pair: unknown) =>
		pair === null ||
		(Array.isArray(pair) &&
			pair.length === 2 &&
			pair.every((d) => typeof d?.id === 'string') &&
			pair[0].id !== pair[1].id);
	check(pairOk(r.body?.pair), 'pair is null or two different DesignData', r.body?.pair);
	for (let i = 0; i < 10; i++) {
		r = await call('GET', '/api/duel', publisher(0));
		const ids: string[] = r.body?.pair?.map((d: { id: string }) => d.id) ?? [];
		if (
			ids.some((id) => mine(publisher(0)).includes(id)) ||
			r.body?.pair?.some((d: { mine: boolean }) => d.mine)
		) {
			check(false, 'GET /api/duel never offers a Device its own Design (spec R2 nextPair)', ids);
			break;
		}
		if (i === 9) check(true, 'GET /api/duel never offers a Device its own Design (10 tries)');
	}
	r = await call('GET', '/api/duel', null);
	check(r.status === 400, 'GET /api/duel without X-Device-Id → 400', r.status);

	/* ---------- POST /api/duels ---------- */
	r = await vote(voter(0), d0, d1, d0);
	requireEndpoint(
		r,
		'POST /api/duels',
		'castDuel (src/lib/server/duels.ts) and src/routes/api/duels/+server.ts'
	);
	check(r.status === 201, 'a vote → 201', r);

	r = await vote(voter(0), d0, d1, d0);
	check(r.status === 409, 'the same Device voting on the same pair again → 409', r.status);
	r = await vote(voter(0), d1, d0, d1);
	check(r.status === 409, 'again in reversed order (and with the other winner) → 409', r.status);
	r = await vote(voter(0), d1, d0, null);
	check(r.status === 409, 'a Skip on a pair already judged → 409', r.status);

	r = await vote(publisher(0), d0, d2, d2);
	check(r.status === 403, 'your own Design as a → 403', r.status);
	r = await vote(publisher(0), d2, d1, d2);
	check(r.status === 403, 'your own Design as b → 403', r.status);

	r = await vote(voter(1), d0, 'zzzzzzzz', d0);
	check(r.status === 404, 'an unknown Design → 404', r.status);

	for (const [label, body] of [
		['a === b', { a: d0, b: d0, winner: d0 }],
		['winner is neither a, b nor null', { a: d0, b: d1, winner: d2 }],
		['an id that is not a Design id', { a: 'not a design', b: d1, winner: d1 }],
		['a missing', { b: d1, winner: d1 }],
		['not JSON', '{oops']
	] as const) {
		r = await call('POST', '/api/duels', voter(1), body);
		check(r.status === 400, `bad body (${label}) → 400`, r.status);
	}
	r = await call('POST', '/api/duels', null, { a: d0, b: d1, winner: d0 });
	check(r.status === 400, 'no X-Device-Id → 400', r.status);

	// Two votes on the same pair at the same moment (once in each order): the primary key lets
	// exactly one in. Same winner, so the expected W–L doesn't depend on which one wins.
	const race = await Promise.all([vote(voter(1), d2, d3, d2), vote(voter(1), d3, d2, d2)]);
	const statuses = race.map((x) => x.status).sort();
	check(
		statuses[0] === 201 && statuses[1] === 409,
		'two concurrent votes on one pair → one 201, one 409',
		statuses
	);

	// A Skip is stored: it can't be cast again, and the pair never comes back
	r = await vote(voter(0), d1, d2, null);
	check(r.status === 201, 'a Skip (winner: null) → 201', r.status);
	r = await vote(voter(0), d2, d1, d2);
	check(r.status === 409, 'voting on a skipped pair → 409', r.status);

	// More decided votes, so d0 leaves provisional (5 decided Duels) and d3 ends last
	const plan: [string, string, string, string][] = [
		[voter(0), d0, d2, d0],
		[voter(0), d0, d3, d0],
		[voter(0), d2, d3, d2],
		[voter(0), d1, d3, d1],
		[voter(1), d0, d1, d0],
		[voter(1), d0, d3, d0],
		[voter(2), d0, d2, d0],
		[voter(2), d1, d3, d1],
		[publisher(1), d0, d3, d0] // publisher 1 owns d2 only, so it may judge this pair
	];
	for (const [device, a, b, winner] of plan) {
		r = await vote(device, a, b, winner);
		check(r.status === 201, `vote ${a} vs ${b} → 201`, r);
	}

	// voter 0 has now judged all 6 pairs of the test Designs; none of them may come back
	const testPairs = new Set([d0, d1, d2, d3]);
	let repeated: string[] | null = null;
	for (let i = 0; i < 15 && !repeated; i++) {
		r = await call('GET', '/api/duel', voter(0));
		const ids: string[] = r.body?.pair?.map((d: { id: string }) => d.id) ?? [];
		if (ids.length === 2 && ids.every((id) => testPairs.has(id))) repeated = ids;
	}
	check(
		!repeated,
		'GET /api/duel never returns a pair the Device judged or skipped (15 tries)',
		repeated
	);

	/* ---------- Leaderboard ---------- */
	let top = await leaderboard('top');
	checkStandings(top, [d0, d1, d2, d3], 'Top');
	const pos = (id: string) => top.findIndex((d) => d.id === id);
	check(
		pos(d0) < pos(d1) && pos(d1) < pos(d3) && pos(d2) < pos(d3),
		'Top: d0 (won all) above d1 and d2, d3 (lost all) below them'
	);
	const fresh = await leaderboard('new');
	check(
		fresh.every((d, i) => i === 0 || fresh[i - 1].createdAt >= d.createdAt),
		'New: newest first'
	);
	check(
		fresh.every((d) => typeof d.rank === 'number' && typeof d.provisional === 'boolean'),
		'New: every Design has rank, wins, losses, provisional too'
	);

	/* ---------- Deleting a Design removes its Duels ---------- */
	r = await call('DELETE', `/api/designs/${d3}`, publisher(2));
	check(r.status === 200, 'deleting d3 → 200', r.status);
	created.splice(3, 1);
	decided.splice(0, decided.length, ...decided.filter((x) => x.winner !== d3 && x.loser !== d3));
	top = await leaderboard('top');
	check(!top.some((d) => d.id === d3), 'Top: d3 is gone');
	checkStandings(top, [d0, d1, d2], 'Top after deleting d3');
	r = await vote(voter(3), d0, d3, d0);
	check(r.status === 404, 'a vote on the deleted Design → 404', r.status);
} catch (e) {
	failed++;
	console.log(e instanceof Stop ? `STOP ${e.message}` : `FAIL ${(e as Error).stack ?? e}`);
} finally {
	// Deleting a Design deletes its Duels too (on delete cascade)
	let cleaned = 0;
	for (const d of created) {
		const r = await call('DELETE', `/api/designs/${d.id}`, d.device).catch(() => null);
		if (r?.status === 200) cleaned++;
		else
			console.log(
				`WARN could not delete test Design ${d.id}: ${r?.status} ${JSON.stringify(r?.body)}`
			);
	}
	console.log(
		`Cleaned up ${cleaned} of ${created.length} test Designs (their Duels went with them).`
	);
}

console.log(failed ? `${failed} failed` : 'All passed');
process.exitCode = failed ? 1 : 0;
