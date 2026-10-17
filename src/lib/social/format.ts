import type { Standing } from '../duels/types';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['week', 7 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600],
	['minute', 60]
];

/** "3 days ago", "yesterday", "just now" */
export function timeAgo(iso: string, now = Date.now()): string {
	const seconds = (new Date(iso).getTime() - now) / 1000;
	for (const [unit, size] of UNITS)
		if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
	return 'just now';
}

export const designerName = (designer: string | null) => designer || 'Anonymous';

type Tally = Pick<Standing, 'wins' | 'losses'>;

/** Share of decided Duels won, "75%", or "–" before the first one. */
export function winRate({ wins, losses }: Tally): string {
	const total = wins + losses;
	return total ? `${Math.round((100 * wins) / total)}%` : '–';
}

/** Wins and losses with the win rate: "3–1 · 75%". */
export const duelRecord = (s: Tally) => `${s.wins}–${s.losses} · ${winRate(s)}`;

/** Link preview text: "by Mia · Rank #3", or "by Mia · New" while the Rank is provisional. */
export const shareDescription = (d: Standing & { designer: string | null }) =>
	`by ${designerName(d.designer)} · ${d.provisional ? 'New' : `Rank #${d.rank}`}`;
