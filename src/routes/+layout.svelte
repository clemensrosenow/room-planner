<script lang="ts">
	import './layout.css';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { saveStep } from '#lib/planner/storage.ts';
	import { STEPS } from '#lib/url.ts';

	let { children } = $props();

	// Every change keeps the furniture within the walls (arrow keys, rotating, resizing,
	// a smaller room) and is saved
	$effect(() => {
		planner.keepAllInside();
		planner.save();
	});

	// Reopen the last step (with its view settings, but no selection) next time
	afterNavigate(({ to }) => {
		if (!to || !STEPS.some((s) => s.path === to.url.pathname)) return;
		const params = new URLSearchParams(to.url.search);
		params.delete('item');
		const query = params.size ? `?${params}` : '';
		saveStep(to.url.pathname + query);
	});

	// Moving between steps cross-fades the pages (View Transitions API, where supported).
	// Query-only changes (selection, view, focus) stay instant.
	onNavigate((nav) => {
		if (!document.startViewTransition || nav.from?.url.pathname === nav.to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	});

	/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y work everywhere except inside form fields. */
	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (e.defaultPrevented) return;
		if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return;
		const key = e.key.toLowerCase();
		if (!(e.ctrlKey || e.metaKey) || (key !== 'z' && key !== 'y')) return;
		e.preventDefault();
		if (key === 'y' || e.shiftKey) planner.redo();
		else planner.undo();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Room Planner</title>
</svelte:head>

<svelte:window {onkeydown} />

<div class="relative h-dvh overflow-hidden">
	<Header />
	<main class="h-full">
		{@render children()}
	</main>
</div>
