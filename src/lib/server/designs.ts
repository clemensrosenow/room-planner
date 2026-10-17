import { and, eq, isNotNull } from 'drizzle-orm';
import type { Standing } from '../duels/types';
import { rank } from '../duels/rank';
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
import { designs, duels } from './schema';
import { decided, standings } from './standings';

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

export function toData(row: Row, standing: Standing, hash: string | null): DesignData {
	return {
		id: row.id,
		roomId: row.roomId,
		title: row.title,
		designer: row.designer,
		placements: row.placements,
		remixedFrom: row.remixedFromTitle
			? { id: row.remixedFromId, title: row.remixedFromTitle, designer: row.remixedFromDesigner }
			: null,
		createdAt: row.createdAt.toISOString(),
		mine: !!hash && row.publisherHash === hash,
		...standing
	};
}

/**
 * Every Design of a Room with where it stands: loads all its Designs and decided Duels once and
 * ranks them (docs/specs/duels.md, R3).
 */
export async function loadRoom(roomId: string) {
	const [rows, judged] = await Promise.all([
		db().select().from(designs).where(eq(designs.roomId, roomId)),
		db()
			.select({ designLo: duels.designLo, designHi: duels.designHi, winnerId: duels.winnerId })
			.from(duels)
			.innerJoin(designs, eq(designs.id, duels.designLo))
			.where(and(eq(designs.roomId, roomId), isNotNull(duels.winnerId)))
	]);
	const results = decided(judged);
	const strength = rank(
		rows.map((r) => r.id),
		results
	);
	return { rows, strength, standing: standings(rows, results, strength) };
}

export async function getDesign(id: string, hash: string | null): Promise<DesignData | null> {
	if (!isDesignId(id)) return null;
	const [row] = await db()
		.select({ roomId: designs.roomId })
		.from(designs)
		.where(eq(designs.id, id));
	if (!row) return null;
	const room = await loadRoom(row.roomId);
	// Deleted between the two queries
	const found = room.rows.find((r) => r.id === id);
	return found ? toData(found, room.standing.get(id)!, hash) : null;
}

/** The Leaderboard: every Design of this Room. Top = by rank, New = newest first, then id. */
export async function listDesigns(sort: Sort, hash: string | null): Promise<DesignPage> {
	const { rows, standing } = await loadRoom(ROOM_ID);
	const order =
		sort === 'top'
			? (a: Row, b: Row) => standing.get(a.id)!.rank - standing.get(b.id)!.rank
			: (a: Row, b: Row) =>
					b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	return { designs: rows.sort(order).map((r) => toData(r, standing.get(r.id)!, hash)) };
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

export const pgCode = (e: unknown): string | undefined => {
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

/** Deletes a design (its Duels go with it). Only the Device that published it may. */
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
