<script lang="ts">
	import { page } from '$app/state';
	import CatalogDock from '#lib/components/CatalogDock.svelte';
	import Inspector from '#lib/components/Inspector.svelte';
	import PieceList from '#lib/components/PieceList.svelte';
	import PlanView from '#lib/components/PlanView.svelte';
	import Scene3D from '#lib/components/Scene3D.svelte';
	import SelectionToolbar from '#lib/components/SelectionToolbar.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import FloatingBar from '#lib/components/ui/FloatingBar.svelte';
	import HelpButton from '#lib/components/ui/HelpButton.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Segmented from '#lib/components/ui/Segmented.svelte';
	import { normalizeAngle } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { selectItem, setParams } from '#lib/url.ts';
	import { duration } from '#lib/motion.ts';
	import { fly, scale } from 'svelte/transition';

	let lowWalls = $state(false);
	let showDims = $state(false);
	let listOpen = $state(false);
	let scene3d = $state<Scene3D>();
	let planView = $state<PlanView>();

	/** `?view=plan` shows the floor plan, anything else the 3D view */
	const view = $derived(page.url.searchParams.get('view') === 'plan' ? 'plan' : '3d');
	const itemId = $derived(page.url.searchParams.get('item'));
	/** `?details=1` opens the panel with exact sizes for the selected piece */
	const details = $derived(page.url.searchParams.has('details'));

	// The selection lives in the URL; mirror it into the planner for the views
	$effect.pre(() => {
		planner.selectedId = itemId;
		return () => (planner.selectedId = null);
	});

	// Drop the selection when the piece is gone (deleted, or removed by undo).
	// This is the only place that deselects after a delete, so history goes back once.
	$effect(() => {
		if (itemId && !planner.furn.some((f) => f.id === itemId)) selectItem(null);
	});

	/** Where the selected piece is on screen, reported by the active view */
	let anchor = $state<{ x: number; y: number } | null>(null);
	let canvasW = $state(0);
	let canvasH = $state(0);

	async function openDetails(id?: string) {
		if (id && id !== itemId) await selectItem(id);
		setParams({ details: 1 }, { replace: true });
	}
	const closeDetails = () => setParams({ details: null }, { replace: true });

	function setView(v: '3d' | 'plan') {
		anchor = null;
		setParams({ view: v === 'plan' ? 'plan' : null }, { replace: true });
	}

	/** Floor point under the pointer in whichever view is shown (for dropping new pieces) */
	const planPoint = (x: number, y: number) =>
		(view === 'plan' ? planView?.planPoint(x, y) : scene3d?.planPoint(x, y)) ?? null;

	/** Arrow keys move the selected piece (1 cm, Shift 10 cm), R rotates, Delete removes, Esc steps back. */
	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (e.defaultPrevented) return;
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
		else if (e.key === 'Delete' || e.key === 'Backspace') planner.remove(f);
		else if (e.key === 'Escape') {
			if (details) closeDetails();
			else selectItem(null);
		} else return;
		e.preventDefault();
	}
</script>

<svelte:head>
	<title>Furnish · Room Planner</title>
</svelte:head>

<svelte:window {onkeydown} />

{#snippet inspector()}
	{#if planner.selected}<Inspector f={planner.selected} />{/if}
{/snippet}

<Workspace
	title="Details"
	sub={planner.selected?.name ?? ''}
	panel={details && planner.selected ? inspector : undefined}
	onclose={closeDetails}
>
	<div class="absolute inset-0" bind:clientWidth={canvasW} bind:clientHeight={canvasH}>
		<!-- The 3D scene stays mounted so the camera keeps its position -->
		<div class="absolute inset-0" hidden={view !== '3d'}>
			<Scene3D
				bind:this={scene3d}
				{lowWalls}
				{showDims}
				onopen={openDetails}
				onanchor={(p) => {
					if (view === '3d') anchor = p;
				}}
			/>
		</div>
		{#if view === 'plan'}
			<div class="absolute inset-0">
				<PlanView
					bind:this={planView}
					{showDims}
					onopen={openDetails}
					onanchor={(p) => {
						if (view === 'plan') anchor = p;
					}}
				/>
			</div>
		{/if}

		{#if planner.furn.length === 0}
			<p
				class="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit rounded-full bg-sheet/85 px-5 py-2.5 text-[14px] font-semibold text-muted shadow-float backdrop-blur-md"
			>
				Drag furniture from below into your room
			</p>
		{/if}

		{#if planner.selected && anchor}
			<!-- Quick actions float above the selected piece, kept inside the view -->
			<div
				transition:scale={{ start: 0.92, duration: duration(140) }}
				class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
				style:left="{Math.min(Math.max(anchor.x, 170), canvasW - 170)}px"
				style:top="{Math.min(Math.max(anchor.y - 14, 150), canvasH - 110)}px"
			>
				<SelectionToolbar f={planner.selected} ondetails={() => openDetails()} />
			</div>
		{/if}
	</div>

	<div class="pointer-events-none absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
		<FloatingBar label="View">
			<Segmented
				label="View"
				value={view}
				options={[
					{ value: '3d', label: '3D', icon: 'cube' },
					{ value: 'plan', label: 'Plan', icon: 'plan' }
				]}
				onchange={setView}
			/>
			<span class="mx-1 h-5 w-px bg-line"></span>
			{#if view === '3d'}
				<IconButton
					icon="low-walls"
					label="Low walls"
					pressed={lowWalls}
					onclick={() => (lowWalls = !lowWalls)}
				/>
				<IconButton icon="recenter" label="Reset view" onclick={() => scene3d?.resetCamera()} />
			{/if}
			<IconButton
				icon="ruler"
				label="Room dimensions"
				pressed={showDims}
				onclick={() => (showDims = !showDims)}
			/>
			<IconButton
				icon="list"
				label="Everything in the room ({planner.furn.length})"
				pressed={listOpen}
				onclick={() => (listOpen = !listOpen)}
			/>
			<HelpButton
				tips={[
					['Drag', 'Move a piece; it snaps to walls and furniture (Alt: free)'],
					['Arrow keys', 'Nudge 1 cm, with Shift 10 cm'],
					['R', 'Rotate 90°'],
					['Delete', 'Remove the selected piece'],
					['Double-click', 'Exact sizes and details'],
					['Esc', 'Close details, then deselect'],
					['Ctrl Z', 'Undo (Ctrl Shift Z redo)']
				]}
			/>
		</FloatingBar>
		{#if listOpen}
			<div transition:fly={{ y: -8, duration: duration(160) }}>
				<PieceList onpick={() => (listOpen = false)} />
			</div>
		{/if}
	</div>

	<!-- On phones the details sheet takes the space of the dock -->
	<div
		class={[
			'pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4',
			details && 'max-md:hidden'
		]}
	>
		<CatalogDock {planPoint} />
	</div>
</Workspace>
