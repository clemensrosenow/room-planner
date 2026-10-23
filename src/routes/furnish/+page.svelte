<script lang="ts">
	import { page } from '$app/state';
	import OnboardingHints from '#lib/components/OnboardingHints.svelte';
	import WelcomeCard from '#lib/components/WelcomeCard.svelte';
	import InventoryDock from '#lib/components/InventoryDock.svelte';
	import PieceList from '#lib/components/PieceList.svelte';
	import PlanView from '#lib/components/PlanView.svelte';
	import Scene3D from '#lib/components/Scene3D.svelte';
	import SelectionToolbar from '#lib/components/SelectionToolbar.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import FloatingBar from '#lib/components/ui/FloatingBar.svelte';
	import HelpButton from '#lib/components/ui/HelpButton.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Segmented from '#lib/components/ui/Segmented.svelte';
	import { DragWatch } from '#lib/onboarding/drag.svelte.ts';
	import { nextOnboarding } from '#lib/onboarding/next.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { INVENTORY } from '#lib/planner/room.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { selectItem, setParams } from '#lib/url.ts';
	import { duration } from '#lib/motion.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import { fly, scale } from 'svelte/transition';

	let listOpen = $state(false);
	/** A Piece is on its way from the dock into the room */
	let dockDragging = $state(false);
	let scene3d = $state<Scene3D>();
	let planView = $state<PlanView>();

	/** `?view=plan` shows the floor plan, anything else the 3D view */
	const view = $derived(page.url.searchParams.get('view') === 'plan' ? 'plan' : '3d');
	const itemId = $derived(page.url.searchParams.get('item'));

	// The selection lives in the URL; mirror it into the planner for the views
	$effect.pre(() => {
		planner.selectedId = itemId;
		return () => (planner.selectedId = null);
	});

	// Drop the selection of a Piece that isn't placed (an old link, put back, undone)
	$effect(() => {
		if (itemId && !planner.furn.some((f) => f.id === itemId)) selectItem(null);
	});

	/** Where the selected piece is on screen, reported by the active view */
	let anchor = $state<{ x: number; y: number } | null>(null);
	let canvasW = $state(0);
	let canvasH = $state(0);

	const drag = new DragWatch();

	const shown = $derived(
		nextOnboarding({
			page: 'furnish',
			state: onboarding.snapshot,
			placed: planner.furn.length,
			total: INVENTORY.length,
			conflicts: planner.conflicts.length,
			selected: !!(planner.selected && anchor),
			dragging: drag.active,
			dialogOpen: ui.modals > 0,
			ownDesign: false
		})
	);

	const touch = new MediaQuery('pointer: coarse');
	/** Tips in the "?" popover: shortcuts for mouse and keyboard, gestures on touch screens */
	const tips = $derived<[string, string][]>(
		touch.current
			? [
					['Drag', 'Move a piece; it snaps to walls and furniture'],
					['Tap in the dock', 'Drop a piece in the middle'],
					['Pinch, two fingers', 'Zoom and pan']
				]
			: [
					['Drag', 'Move a piece; it snaps to walls and furniture (Alt: free)'],
					['Arrow keys', 'Nudge 1 cm, with Shift 10 cm'],
					['R', 'Rotate 90°'],
					['Delete', 'Remove from the room'],
					['Esc', 'Deselect'],
					['Ctrl Z', 'Undo (Ctrl Shift Z redo)']
				]
	);

	function setView(v: '3d' | 'plan') {
		anchor = null;
		setParams({ view: v === 'plan' ? 'plan' : null }, { replace: true });
	}

	/** Floor point under the pointer in whichever view is shown (for dropping Pieces from the dock) */
	const planPoint = (x: number, y: number) =>
		(view === 'plan' ? planView?.planPoint(x, y) : scene3d?.planPoint(x, y)) ?? null;

	/**
	 * Arrow keys move the selected piece (1 cm, Shift 10 cm), R rotates, Delete puts it back into
	 * the dock, Esc deselects.
	 */
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
		else if (e.key === 'r' || e.key === 'R') planner.rotate(f, e.shiftKey ? -90 : 90);
		else if (e.key === 'Delete' || e.key === 'Backspace') planner.unplace(f.id);
		else if (e.key === 'Escape') selectItem(null);
		else return;
		e.preventDefault();
	}
</script>

<svelte:head>
	<title>Furnish · Room Planner</title>
</svelte:head>

<svelte:window
	{onkeydown}
	onpointerdown={drag.down}
	onpointermove={drag.move}
	onpointerup={drag.up}
	onpointercancel={drag.up}
/>

<Workspace>
	<div class="absolute inset-0" bind:clientWidth={canvasW} bind:clientHeight={canvasH}>
		<!-- The 3D scene stays mounted so the camera keeps its position -->
		<div class="absolute inset-0" hidden={view !== '3d'}>
			<Scene3D
				bind:this={scene3d}
				onanchor={(p) => {
					if (view === '3d') anchor = p;
				}}
			/>
		</div>
		{#if view === 'plan'}
			<div class="absolute inset-0">
				<PlanView
					bind:this={planView}
					onanchor={(p) => {
						if (view === 'plan') anchor = p;
					}}
				/>
			</div>
		{/if}

		{#if planner.furn.length === 0 && shown !== 'drag-in'}
			<p
				class="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit rounded-full bg-sheet/85 px-5 py-2.5 text-[14px] font-semibold text-muted shadow-float backdrop-blur-md"
			>
				Drag your furniture from below into the room
			</p>
		{/if}

		{#if planner.selected && anchor}
			<!-- Quick actions float above the selected piece, kept inside the view; docked on phones -->
			<div
				transition:scale={{ start: 0.92, duration: duration(140) }}
				data-hint="toolbar"
				class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full max-md:hidden"
				style:left="{Math.min(Math.max(anchor.x, 170), canvasW - 170)}px"
				style:top="{Math.min(Math.max(anchor.y - 14, 150), canvasH - 110)}px"
			>
				<SelectionToolbar f={planner.selected} />
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
			<IconButton
				icon="list"
				label="Everything in the room ({planner.furn.length})"
				pressed={listOpen}
				onclick={() => (listOpen = !listOpen)}
			/>
			<HelpButton {tips} />
		</FloatingBar>
		{#if listOpen}
			<div transition:fly={{ y: -8, duration: duration(160) }}>
				<PieceList onpick={() => (listOpen = false)} />
			</div>
		{/if}
	</div>

	<!--
		On phones the selected Piece's actions take the space of the dock; undo and redo sit above
		them, as the header has no room for them there
	-->
	<div
		class="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-4"
	>
		<div class="self-end sm:hidden">
			<FloatingBar label="History">
				<IconButton
					icon="undo"
					label="Undo"
					disabled={!planner.canUndo}
					onclick={() => planner.undo()}
				/>
				<IconButton
					icon="redo"
					label="Redo"
					disabled={!planner.canRedo}
					onclick={() => planner.redo()}
				/>
			</FloatingBar>
		</div>
		{#if planner.selected && !dockDragging}
			<div class="md:hidden" data-hint="toolbar" transition:fly={{ y: 8, duration: duration(140) }}>
				<SelectionToolbar f={planner.selected} docked />
			</div>
		{/if}
		<div
			class={[
				'flex max-w-full justify-center',
				planner.selected && !dockDragging && 'max-md:hidden'
			]}
		>
			<InventoryDock {planPoint} bind:dragging={dockDragging} />
		</div>
	</div>
</Workspace>

<WelcomeCard open={shown === 'welcome'} />
<OnboardingHints {shown} />
