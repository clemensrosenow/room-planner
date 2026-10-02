// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** The selection added this history entry, so deselecting can go back */
			selectionPushed?: boolean;
		}
		// interface Platform {}
	}
}

export {};
