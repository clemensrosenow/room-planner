<script lang="ts">
	import { page } from '$app/state';
	import FurnitureList from '#lib/components/FurnitureList.svelte';
	import PlanView from '#lib/components/PlanView.svelte';
	import Scene3D from '#lib/components/Scene3D.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import { normalizeAngle } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { selectItem, setParams } from '#lib/url.ts';

	let lowWalls = $state(false);
	let showDims = $state(true);
	let scene3d = $state<Scene3D>();

	/** `?view=plan` shows the floor plan, anything else the 3D view */
	const view = $derived(page.url.searchParams.get('view') === 'plan' ? 'plan' : '3d');
	const itemId = $derived(page.url.searchParams.get('item'));

	// The selection lives in the URL; mirror it into the planner for the views
	$effect.pre(() => {
		planner.selectedId = itemId;
		return () => (planner.selectedId = null);
	});

	// Drop the selection when the piece is gone (deleted, or removed by undo)
	$effect(() => {
		if (itemId && !planner.furn.some((f) => f.id === itemId)) selectItem(null);
	});

	/** Arrow keys move the selected piece (1 cm, Shift 10 cm), R rotates, Esc deselects. */
	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		// Inside form fields the browser's own shortcuts apply
		if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return;
		if (e.ctrlKey || e.metaKey) return;
		const f = planner.selected;
		if (!f) return;
		const step = e.shiftKey ? 10 : 1;
		if (e.key === 'ArrowLeft') f.cx -= step;
		else if (e.key === 'ArrowRight') f.cx += step;
		else if (e.key === 'ArrowUp') f.cy -= step;
		else if (e.key === 'ArrowDown') f.cy += step;
		else if (e.key === 'r' || e.key === 'R')
			f.rot = normalizeAngle(f.rot + (e.shiftKey ? -90 : 90));
		else if (e.key === 'Escape') selectItem(null);
		else return;
		e.preventDefault();
	}
</script>

<svelte:head>
	<title>Furnish · Room Planner</title>
</svelte:head>

<svelte:window {onkeydown} />

<Workspace asideLabel="Furniture">
	{#snippet toolbar()}
		<div class="inline-flex overflow-hidden rounded-[5px] border border-line-strong" role="group">
			{#each [['3d', '3D'], ['plan', 'Floor plan']] as const as [v, label] (v)}
				<button
					class={[
						'cursor-pointer px-3 py-[5px] text-[13px] font-semibold',
						view === v && 'bg-ink text-sheet'
					]}
					aria-pressed={view === v}
					onclick={() => setParams({ view: v === 'plan' ? 'plan' : null }, { replace: true })}
					>{label}</button
				>
			{/each}
		</div>
		{#if view === '3d'}
			<button class="btn" aria-pressed={lowWalls} onclick={() => (lowWalls = !lowWalls)}>
				Low walls
			</button>
			<button class="btn" onclick={() => scene3d?.resetCamera()}>Reset view</button>
		{:else}
			<button class="btn" aria-pressed={showDims} onclick={() => (showDims = !showDims)}>
				Dimensions
			</button>
		{/if}
		<span class="ml-auto text-xs text-muted max-[900px]:hidden">
			Drag furniture (Alt: no snapping) · arrow keys 1 cm (⇧ 10 cm) · R rotates 90°
		</span>
	{/snippet}

	<!-- The 3D scene stays mounted so the camera keeps its position -->
	<div class="absolute inset-0" hidden={view !== '3d'}>
		<Scene3D bind:this={scene3d} {lowWalls} />
	</div>
	{#if view === 'plan'}
		<div class="absolute inset-0"><PlanView {showDims} /></div>
	{/if}

	{#snippet aside()}
		<FurnitureList />
	{/snippet}
</Workspace>
