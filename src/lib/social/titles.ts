import { TITLE_MAX } from './types';

const ADJECTIVES = [
	'Sunlit',
	'Cozy',
	'Airy',
	'Quiet',
	'Bright',
	'Snug',
	'Calm',
	'Golden',
	'Breezy',
	'Serene',
	'Minimal',
	'Charming'
];
const NOUNS = ['Loft', 'Nook', 'Retreat', 'Studio', 'Hideaway', 'Haven', 'Den', 'Corner', 'Suite'];
const FEATURES = [
	'with Loggia View',
	'by the Window',
	'for Night Owls',
	'for Early Birds',
	'with Morning Sun',
	'with Room to Breathe',
	'near the Balcony',
	'for Slow Sundays',
	'with a Reading Corner',
	'for Deep Work'
];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** An Airbnb-style name, e.g. "Sunlit Loft with Loggia View". Different from `previous`. */
export function suggestTitle(previous?: string): string {
	for (;;) {
		const title = `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(FEATURES)}`;
		if (title !== previous && title.length <= TITLE_MAX) return title;
	}
}
