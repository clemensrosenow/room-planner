import type { Standing } from '../duels/types';
import type { Placements } from '../planner/room';

/** Limits of a Published Design, checked on the client and again on the server. */
export const TITLE_MAX = 60;
export const DESIGNER_MAX = 30;

/** A Published Design as the API returns it, with where it stands on the Leaderboard. */
export interface DesignData extends Standing {
	id: string;
	roomId: string;
	title: string;
	/** null = Anonymous */
	designer: string | null;
	placements: Placements;
	/** id null with a title = the source was deleted; null = not a remix */
	remixedFrom: { id: string | null; title: string; designer: string | null } | null;
	/** ISO timestamp */
	createdAt: string;
	/** This Device published it */
	mine: boolean;
}

/** The whole Leaderboard: every Design of the Room, in one response. */
export interface DesignPage {
	designs: DesignData[];
}

export type Sort = 'top' | 'new';

export interface PublishRequest {
	title: string;
	designer?: string | null;
	placements: Placements;
	remixedFromId?: string;
}
