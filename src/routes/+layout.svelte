<script lang="ts">
	import './layout.css';
	import { afterNavigate } from '$app/navigation';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { saveStep } from '#lib/planner/storage.ts';
	import { STEPS } from '#lib/url.ts';

	let { children } = $props();

	// Auto-save every change
	$effect(() => planner.save());

	// Reopen the last step (with its view settings, but no selection) next time
	afterNavigate(({ to }) => {
		if (!to || !STEPS.some((s) => s.path === to.url.pathname)) return;
		const params = new URLSearchParams(to.url.search);
		params.delete('item');
		const query = params.size ? `?${params}` : '';
		saveStep(to.url.pathname + query);
	});

	/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y work everywhere except inside form fields. */
	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
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

<div class="flex h-full flex-col gap-3 px-4 pt-3.5 pb-4 max-[900px]:h-auto">
	<Header />
	<main class="min-h-0 flex-1">
		{@render children()}
	</main>
</div>
