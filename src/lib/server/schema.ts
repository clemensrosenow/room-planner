import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	check,
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp
} from 'drizzle-orm/pg-core';
import type { Placements } from '../planner/room';

/** Published Designs never change after publishing (ADR 0003): only insert and delete. */
export const designs = pgTable(
	'designs',
	{
		id: text('id').primaryKey(),
		roomId: text('room_id').notNull(),
		title: text('title').notNull(),
		/** null = Anonymous */
		designer: text('designer'),
		placements: jsonb('placements').$type<Placements>().notNull(),
		/** Becomes null when the source is deleted; title and designer stay for "Remix of …" */
		remixedFromId: text('remixed_from_id').references((): AnyPgColumn => designs.id, {
			onDelete: 'set null'
		}),
		remixedFromTitle: text('remixed_from_title'),
		remixedFromDesigner: text('remixed_from_designer'),
		/** sha256 of the publishing Device's id (ADR 0001) */
		publisherHash: text('publisher_hash').notNull(),
		// Millisecond precision, so a timestamp round-trips through JS exactly
		createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow()
	},
	(t) => [index('designs_new_idx').on(t.roomId, t.createdAt.desc(), t.id.desc())]
);

/**
 * One Device's judgement of a pair of Designs (docs/specs/duels.md, R1). The pair is stored
 * normalized (design_lo < design_hi), so the primary key allows one Duel per Device per pair.
 */
export const duels = pgTable(
	'duels',
	{
		designLo: text('design_lo')
			.notNull()
			.references(() => designs.id, { onDelete: 'cascade' }),
		designHi: text('design_hi')
			.notNull()
			.references(() => designs.id, { onDelete: 'cascade' }),
		/** sha256 of the judging Device's id (ADR 0001) */
		voterHash: text('voter_hash').notNull(),
		/** design_lo, design_hi, or null = Skip */
		winnerId: text('winner_id'),
		createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.designLo, t.designHi, t.voterHash] }),
		check('duels_pair_order', sql`${t.designLo} < ${t.designHi}`),
		check(
			'duels_winner_in_pair',
			sql`${t.winnerId} is null or ${t.winnerId} in (${t.designLo}, ${t.designHi})`
		),
		index('duels_voter_idx').on(t.voterHash)
	]
);
