import { and, desc, eq, sql } from 'drizzle-orm';
import {
	conflictIds,
	designFurniture,
	parsePlacements,
	ROOM_ID,
	type Placements
} from '../planner/room';
import { slugify } from '../social/slug';
import {
	DESIGNER_MAX,
	TITLE_MAX,
	type DesignData,
	type DesignPage,
	type Sort
} from '../social/types';
import { db } from './db';
import { designs, likes } from './schema';

export const PAGE_SIZE = 24;

/** An expected failure with an HTTP status, turned into a JSON response by the endpoints. */
export class HttpFail extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly extra: Record<string, unknown> = {}
	) {
		super(message);
	}
}

/* ---------- Device identity (ADR 0001) ---------- */

/** sha256 (hex) of the request's X-Device-Id; null when missing. Only the hash is ever stored. */
export async function deviceHash(request: Request): Promise<string | null> {
	const id = request.headers.get('x-device-id')?.trim();
	if (!id || id.length > 100) return null;
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function requireDevice(request: Request): Promise<string> {
	const hash = await deviceHash(request);
	if (!hash) throw new HttpFail(400, 'Missing X-Device-Id header');
	return hash;
}

/* ---------- Reading ---------- */

type Row = typeof designs.$inferSelect;

/** Readable 8-char ids: lowercase letters and digits without look-alikes (l, o, 0, 1). */
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const newId = () =>
	Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ID_ALPHABET[b % 32]).join('');
export const isDesignId = (id: string) => /^[a-z0-9]{8}$/.test(id);

function toData(row: Row, likedByMe: boolean, hash: string | null): DesignData {
	return {
		id: row.id,
		roomId: row.roomId,
		title: row.title,
		designer: row.designer,
		placements: row.placements,
		remixedFrom: row.remixedFromTitle
			? { id: row.remixedFromId, title: row.remixedFromTitle, designer: row.remixedFromDesigner }
			: null,
		likeCount: row.likeCount,
		createdAt: row.createdAt.toISOString(),
		likedByMe,
		mine: !!hash && row.publisherHash === hash
	};
}

/** Whether the Device with this hash liked the design (false without a Device). */
const likedBy = (hash: string | null) =>
	hash
		? sql<boolean>`exists (select 1 from ${likes} where ${likes.designId} = ${designs.id} and ${likes.likerHash} = ${hash})`
		: sql<boolean>`false`;

export async function getDesign(id: string, hash: string | null): Promise<DesignData | null> {
	if (!isDesignId(id)) return null;
	const [r] = await db()
		.select({ row: designs, liked: likedBy(hash) })
		.from(designs)
		.where(eq(designs.id, id));
	return r ? toData(r.row, r.liked, hash) : null;
}

/** Keyset cursor: the sort values of the last design on the page. */
type Cursor = [likes: number, createdAt: string, id: string];

/** base64url of the JSON (ASCII only, so btoa is enough) */
const encodeCursor = (r: Row): string =>
	btoa(JSON.stringify([r.likeCount, r.createdAt.toISOString(), r.id]))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');

function decodeCursor(s: string): Cursor {
	try {
		const c = JSON.parse(atob(s.replaceAll('-', '+').replaceAll('_', '/')));
		if (
			Array.isArray(c) &&
			Number.isInteger(c[0]) &&
			!Number.isNaN(Date.parse(c[1])) &&
			typeof c[2] === 'string'
		)
			return c as Cursor;
	} catch {
		// fall through
	}
	throw new HttpFail(400, 'Invalid cursor');
}

/**
 * Leaderboard page: Top = most Likes first, New = newest first. PAGE_SIZE designs per page;
 * `nextCursor` is null on the last page.
 *
 * TODO(Clemens): implement.
 * - Only designs of this Room (ROOM_ID).
 * - Top: like_count desc, then created_at desc. New: created_at desc. Add a final tie-breaker so
 *   the order is total (two designs can share likes and timestamp).
 * - Keyset pagination: `cursor` holds the sort values of the last design of the previous page
 *   (decodeCursor / encodeCursor above). Fetch the rows that come after it in the sort order.
 *   Tip: fetch PAGE_SIZE + 1 rows to know whether there is a next page.
 * - Each design needs `likedByMe` (see likedBy) and `mine`; toData(row, liked, hash) builds it.
 * The indexes in schema.ts (designs_top_idx, designs_new_idx) match this order.
 */
export async function listDesigns(
	sort: Sort,
	cursor: string | null,
	hash: string | null
): Promise<DesignPage> {
	throw new HttpFail(501, 'The Leaderboard is not implemented yet');
}

/* ---------- Publishing and deleting ---------- */

interface Publish {
	title: string;
	designer: string | null;
	placements: Placements;
	remixedFromId: string | null;
}

/** Checks a publish request body; throws 400 (invalid) or 422 (Conflicts). */
export function parsePublish(body: unknown): Publish {
	const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
	const title = typeof b.title === 'string' ? b.title.trim() : '';
	if (!title || title.length > TITLE_MAX)
		throw new HttpFail(400, `The title needs 1–${TITLE_MAX} characters`);
	if (b.designer != null && typeof b.designer !== 'string') throw new HttpFail(400, 'Invalid name');
	const designer = (b.designer ?? '').trim();
	if (designer.length > DESIGNER_MAX)
		throw new HttpFail(400, `The name can have at most ${DESIGNER_MAX} characters`);
	const placements = parsePlacements(b.placements);
	if (!placements) throw new HttpFail(400, 'Every piece needs a valid position');
	const conflicts = conflictIds(designFurniture(placements)).length;
	if (conflicts)
		throw new HttpFail(422, `Resolve ${conflicts} conflict${conflicts === 1 ? '' : 's'} first`, {
			conflicts
		});
	const remixedFromId = typeof b.remixedFromId === 'string' ? b.remixedFromId : null;
	return { title, designer: designer || null, placements, remixedFromId };
}

const pgCode = (e: unknown): string | undefined => {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code ?? err?.cause?.code;
};

export async function publish(p: Publish, hash: string) {
	// A source that doesn't exist (anymore) is silently dropped
	const [source] =
		p.remixedFromId && isDesignId(p.remixedFromId)
			? await db()
					.select({ id: designs.id, title: designs.title, designer: designs.designer })
					.from(designs)
					.where(eq(designs.id, p.remixedFromId))
			: [];
	const values = {
		roomId: ROOM_ID,
		title: p.title,
		designer: p.designer,
		placements: p.placements,
		remixedFromId: source?.id ?? null,
		remixedFromTitle: source?.title ?? null,
		remixedFromDesigner: source?.designer ?? null,
		publisherHash: hash
	};
	// An id collision is astronomically unlikely, but costs nothing to retry
	for (let attempt = 0; ; attempt++) {
		const id = newId();
		try {
			await db()
				.insert(designs)
				.values({ id, ...values });
			return { id, slug: slugify(p.title) };
		} catch (e) {
			if (pgCode(e) !== '23505' || attempt >= 2) throw e;
		}
	}
}

/** Deletes a design (its Likes go with it). Only the Device that published it may. */
export async function remove(id: string, hash: string) {
	const [row] = isDesignId(id)
		? await db()
				.select({ publisherHash: designs.publisherHash })
				.from(designs)
				.where(eq(designs.id, id))
		: [];
	if (!row) throw new HttpFail(404, 'Design not found');
	if (row.publisherHash !== hash) throw new HttpFail(403, 'Only its publisher can delete a design');
	await db().delete(designs).where(eq(designs.id, id));
}

/* ---------- Likes ---------- */

/**
 * Likes or unlikes and returns the new like count.
 * - 404 if the design doesn't exist, 403 when liking your own (done below).
 * - Idempotent: liking twice counts once, unliking something not liked changes nothing.
 * - `likes` (one row per Like, primary key design_id + liker_hash) and `designs.like_count` must
 *   never drift apart, even when two people like at the same moment.
 * - A design deleted in the meantime should end in a 404, not a 500 (see pgCode).
 *
 * TODO(Clemens): implement the write.
 */
export async function setLike(id: string, hash: string, liked: boolean): Promise<number> {
	const [row] = isDesignId(id)
		? await db()
				.select({ publisherHash: designs.publisherHash })
				.from(designs)
				.where(eq(designs.id, id))
		: [];
	if (!row) throw new HttpFail(404, 'Design not found');
	if (liked && row.publisherHash === hash)
		throw new HttpFail(403, "You can't like your own design");
	throw new HttpFail(501, 'Likes are not implemented yet');
}
