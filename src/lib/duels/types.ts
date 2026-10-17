/** Shared Duel types (docs/specs/duels.md). Pure: no DB, no DOM. */

/** One decided Duel, as `rank` reads it. Skips never get here. */
export interface DuelResult {
	winner: string;
	loser: string;
}

/** A Design `nextPair` may choose from, seen from the asking Device. */
export interface DuelCandidate {
	id: string;
	/** This Device published it */
	mine: boolean;
	/** Decided Duels it took part in */
	duels: number;
	/** From `rank` */
	strength: number;
}

/** Where a Published Design stands on the Leaderboard; joins DesignData once Likes are gone. */
export interface Standing {
	/** 1-based, by strength; equal strength → newer first, then id */
	rank: number;
	/** Real decided Duels only: no Skips, no prior */
	wins: number;
	losses: number;
	/** wins + losses < PROVISIONAL_BELOW */
	provisional: boolean;
}

export const PROVISIONAL_BELOW = 5;

/** POST /api/duels body; `winner` is `a`, `b`, or null for Skip. */
export interface CastDuelRequest {
	a: string;
	b: string;
	winner: string | null;
}

/** Normalized key of an unordered pair: the smaller id first. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
