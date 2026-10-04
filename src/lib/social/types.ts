import type { Placements } from '../planner/room';

/** Limits of a Published Design, checked on the client and again on the server. */
export const TITLE_MAX = 60;
export const DESIGNER_MAX = 30;

/** A Published Design as the API returns it. */
export interface DesignData {
	id: string;
	roomId: string;
	title: string;
	/** null = Anonymous */
	designer: string | null;
	placements: Placements;
	/** id null with a title = the source was deleted; null = not a remix */
	remixedFrom: { id: string | null; title: string; designer: string | null } | null;
	likeCount: number;
	/** ISO timestamp */
	createdAt: string;
	/** This Device liked it */
	likedByMe: boolean;
	/** This Device published it */
	mine: boolean;
}

export interface DesignPage {
	designs: DesignData[];
	/** Pass to the next request for more; null when this was the last page */
	nextCursor: string | null;
}

export type Sort = 'top' | 'new';

export interface PublishRequest {
	title: string;
	designer?: string | null;
	placements: Placements;
	remixedFromId?: string;
}
