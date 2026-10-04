import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	index,
	integer,
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
		likeCount: integer('like_count').notNull().default(0),
		// Millisecond precision, so a timestamp round-trips through JS exactly (pagination cursor)
		createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow()
	},
	(t) => [
		index('designs_top_idx').on(t.roomId, t.likeCount.desc(), t.createdAt.desc(), t.id.desc()),
		index('designs_new_idx').on(t.roomId, t.createdAt.desc(), t.id.desc())
	]
);

export const likes = pgTable(
	'likes',
	{
		designId: text('design_id')
			.notNull()
			.references(() => designs.id, { onDelete: 'cascade' }),
		likerHash: text('liker_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`now()`)
	},
	(t) => [primaryKey({ columns: [t.designId, t.likerHash] })]
);
