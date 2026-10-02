<script lang="ts">
	import FurnitureList from '#lib/components/FurnitureList.svelte';
	import Header from '#lib/components/Header.svelte';
	import PlanView from '#lib/components/PlanView.svelte';
	import RoomSettings from '#lib/components/RoomSettings.svelte';
	import Scene3D from '#lib/components/Scene3D.svelte';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { normalizeAngle } from '#lib/planner/furniture.ts';

	let lowWalls = $state(false);
	let showDims = $state(true);
	let scene3d = $state<Scene3D>();

	// Auto-save every change
	$effect(() => planner.save());

	/** Arrow keys move the selected piece (1 cm, Shift 10 cm), R rotates, Esc deselects. */
	function onkeydown(e: KeyboardEvent) {
		const f = planner.selected;
		const t = e.target as HTMLElement;
		if (!f || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return;
		const step = e.shiftKey ? 10 : 1;
		if (e.key === 'ArrowLeft') f.cx -= step;
		else if (e.key === 'ArrowRight') f.cx += step;
		else if (e.key === 'ArrowUp') f.cy -= step;
		else if (e.key === 'ArrowDown') f.cy += step;
		else if (e.key === 'r' || e.key === 'R')
			f.rot = normalizeAngle(f.rot + (e.shiftKey ? -90 : 90));
		else if (e.key === 'Escape') planner.select(null);
		else return;
		e.preventDefault();
	}
</script>

<svelte:head>
	<title>Room Planner</title>
</svelte:head>

<svelte:window {onkeydown} />

<div
	class="grid h-full grid-cols-[minmax(0,1fr)_384px] grid-rows-[auto_minmax(0,1fr)] gap-3 px-4 pt-3.5 pb-4 max-[900px]:h-auto max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:grid-rows-none"
>
	<Header />

	<section
		class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-line bg-sheet"
		aria-label="View"
	>
		<div class="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
			<div class="inline-flex overflow-hidden rounded-[5px] border border-line-strong" role="group">
				{#each [['3d', '3D'], ['plan', 'Floor plan']] as const as [v, label] (v)}
					<button
						class={[
							'cursor-pointer px-3 py-[5px] text-[13px] font-semibold',
							planner.view === v && 'bg-ink text-sheet'
						]}
						aria-pressed={planner.view === v}
						onclick={() => planner.setView(v)}>{label}</button
					>
				{/each}
			</div>
			{#if planner.view === '3d'}
				<button class="tbtn" aria-pressed={lowWalls} onclick={() => (lowWalls = !lowWalls)}>
					Low walls
				</button>
				<button class="tbtn" onclick={() => scene3d?.resetCamera()}>Reset view</button>
			{:else}
				<button class="tbtn" aria-pressed={showDims} onclick={() => (showDims = !showDims)}>
					Dimensions
				</button>
			{/if}
			<span class="ml-auto text-xs text-muted max-[900px]:hidden">
				Drag furniture · arrow keys 1 cm (⇧ 10 cm) · R rotates 90°
			</span>
		</div>
		<div
			class="relative min-h-[340px] flex-1 max-[900px]:h-[min(64vh,540px)] max-[900px]:flex-none"
		>
			<div class="absolute inset-0" hidden={planner.view !== '3d'}>
				<Scene3D bind:this={scene3d} {lowWalls} />
			</div>
			{#if planner.view === 'plan'}
				<div class="absolute inset-0"><PlanView {showDims} /></div>
			{/if}
		</div>
	</section>

	<aside
		class="min-h-0 overflow-auto rounded-md border border-line bg-sheet max-[900px]:overflow-visible"
		aria-label="Dimensions and furniture"
	>
		{#if planner.geo.issues.length}
			<ul
				class="mx-3 mt-2.5 list-disc rounded-[5px] bg-warn-soft py-2 pr-2.5 pl-6 text-[12.5px] text-warn"
			>
				{#each planner.geo.issues as issue (issue)}
					<li>{issue}</li>
				{/each}
			</ul>
		{/if}
		<RoomSettings />
		<FurnitureList />
	</aside>
</div>

<style>
	.tbtn {
		cursor: pointer;
		border: 1px solid var(--line);
		border-radius: 5px;
		padding: 5px 10px;
		font-size: 13px;
	}
	.tbtn:hover {
		border-color: var(--line-strong);
	}
	.tbtn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-soft);
	}
</style>
