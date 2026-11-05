<script lang="ts">
	import { page } from '$app/state';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import { PreviewScene, type CameraMode } from '#lib/preview/PreviewScene.ts';
	import { makeShots } from '#lib/preview/shots.ts';
	import { dayGradient, dayOfYear, formatTime, sunDirection } from '#lib/preview/sun.ts';
	import { setParams } from '#lib/url.ts';
	import { onMount, untrack } from 'svelte';
	import FloatingBar from './ui/FloatingBar.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';
	import Loader from './ui/Loader.svelte';

	interface Props {
		/** Pieces to show; the Draft when omitted */
		furn?: Furniture[];
		/** Viewpoint without ?shot= */
		defaultShot?: string;
		/** Explain the walking controls at the top */
		hint?: boolean;
	}
	let { furn, defaultShot = 'above', hint = true }: Props = $props();

	const DEFAULT_TIME = 10;
	/** The loader gives up waiting for slow models after this many ms */
	const LOAD_TIMEOUT = 8000;

	/** "18h30" (or "18:30") → 18.5, clamped to the slider range */
	function parseTime(v: string | null) {
		const m = v?.match(/^(\d{1,2})[h:](\d{2})$/);
		if (!m) return DEFAULT_TIME;
		return Math.min(21.5, Math.max(5, Number(m[1]) + Number(m[2]) / 60));
	}

	// The URL (?shot=, ?time=18h30, ?lamp=1, ?mode=tour) sets the starting state
	const params = page.url.searchParams;
	const startMode = params.get('mode');

	let wrap: HTMLDivElement;
	let container: HTMLDivElement;
	let scene = $state<PreviewScene | null>(null);
	let failed = $state(false);
	/** Every real model is in, or loading took too long to keep waiting */
	let ready = $state(false);

	let mode = $state<CameraMode>('walk');
	// svelte-ignore state_referenced_locally
	let activeShot = $state(params.get('shot') ?? defaultShot);
	let hours = $state(parseTime(params.get('time')));
	let lamp = $state(params.get('lamp') === '1');

	const shots = $derived(makeShots(planner.geo));
	const corners = $derived(shots.filter((s) => s.id.startsWith('corner')));
	const isDay = $derived(sunDirection(hours, dayOfYear()).y > -0.03);
	/** Slider track colored by today's real sun path */
	const track = dayGradient();

	onMount(() => {
		try {
			scene = new PreviewScene(container);
		} catch {
			failed = true;
			return;
		}
		scene.onModeChange = (m) => (mode = m);
		// Walking away from a viewpoint unselects it
		scene.onManual = () => (activeShot = '');
		scene.onSettled = () => (ready = true);
		const timer = setTimeout(() => (ready = true), LOAD_TIMEOUT);
		return () => {
			clearTimeout(timer);
			scene?.dispose();
		};
	});

	// Rebuild when the room or furniture changes; the first build places the camera
	let placed = false;
	$effect(() => {
		const s = scene;
		if (!s) return;
		s.build(planner.geo, $state.snapshot(furn ?? planner.furn));
		if (placed) return;
		placed = true;
		// Untracked: picking a shot or mode later must not rebuild the scene
		untrack(() => {
			const start = shots.find((sh) => sh.id === activeShot) ?? shots[0];
			s.goTo(start, true);
			activeShot = start.id;
			if (startMode === 'tour') toggleTour();
		});
	});
	$effect(() => scene?.setTime(hours));
	$effect(() => scene?.setLamp(lamp));

	// Mirror the state into the URL (debounced, the slider changes it quickly)
	$effect(() => {
		const next = {
			shot: activeShot && activeShot !== defaultShot ? activeShot : null,
			time: hours !== DEFAULT_TIME ? formatTime(hours).replace(':', 'h') : null,
			lamp: lamp ? 1 : null,
			mode: mode === 'tour' ? mode : null
		};
		const timer = setTimeout(() => setParams(next, { replace: true }), 300);
		return () => clearTimeout(timer);
	});

	function goTo(id: string) {
		const shot = shots.find((s) => s.id === id);
		if (!shot || !scene) return;
		scene.goTo(shot);
		activeShot = id;
		mode = shot.cutaway ? 'overview' : 'walk';
	}

	function toggleTour() {
		if (!scene) return;
		if (mode === 'tour') {
			scene.setMode('walk');
			mode = 'walk';
		} else {
			scene.startTour(shots.filter((s) => !s.cutaway));
			mode = 'tour';
			activeShot = '';
		}
	}

	function fullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else wrap.requestFullscreen?.();
	}

	/* During the tour the controls fade out until the pointer moves */
	let idle = $state(false);
	let idleTimer: ReturnType<typeof setTimeout>;
	function wake() {
		idle = false;
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => (idle = true), 2500);
	}
	$effect(() => () => clearTimeout(idleTimer));
	const hideUi = $derived(mode === 'tour' && idle);

	const pad: [string, string, string, string][] = [
		['arrowup', 'chevron-up', 'col-start-2', 'Walk forward'],
		['arrowleft', 'chevron-left', 'col-start-1 row-start-2', 'Turn left'],
		['arrowdown', 'chevron-down', 'col-start-2 row-start-2', 'Walk back'],
		['arrowright', 'chevron-right', 'col-start-3 row-start-2', 'Turn right']
	];

	const chip = (active: boolean) => [
		'flex-none cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
		active ? 'bg-ink text-sheet' : 'text-muted hover:text-ink'
	];
</script>

<div
	bind:this={wrap}
	class={['relative isolate h-full w-full bg-[#1c1a17]', hideUi && 'cursor-none']}
	onpointermove={wake}
	role="presentation"
>
	<div bind:this={container} class="h-full w-full"></div>

	{#if failed}
		<div class="absolute inset-0 grid place-items-center p-5 text-center text-white/70">
			The preview needs WebGL, which this browser doesn't support.
		</div>
	{:else}
		{#if mode === 'walk'}
			{#if hint}
				<p
					class="pointer-events-none absolute inset-x-0 top-20 mx-auto w-fit rounded-full bg-sheet/85 px-4 py-1.5 text-[13px] text-muted shadow-float backdrop-blur-md"
				>
					Drag to look around · ↑↓ to walk · ←→ to turn · scroll to zoom
				</p>
			{/if}
			<div class="absolute right-4 bottom-36 z-10 grid grid-cols-3 gap-1.5 md:bottom-20">
				{#each pad as [key, icon, pos, label] (key)}
					<button
						class="{pos} grid size-11 cursor-pointer place-items-center rounded-full bg-sheet/85 text-ink shadow-float backdrop-blur-md select-none active:bg-accent-soft"
						aria-label={label}
						onpointerdown={() => scene?.press(key, true)}
						onpointerup={() => scene?.press(key, false)}
						onpointerleave={() => scene?.press(key, false)}
					>
						<Icon name={icon as 'chevron-up'} />
					</button>
				{/each}
			</div>
		{/if}

		<div
			class={[
				'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-4 transition-opacity duration-700 md:flex-row md:items-end md:justify-between',
				hideUi && 'opacity-0'
			]}
		>
			<FloatingBar label="Light">
				<span class="grid size-9 place-items-center text-muted">
					<Icon name={isDay ? 'sun' : 'moon'} />
				</span>
				<input
					type="range"
					min="5"
					max="21.5"
					step="0.25"
					bind:value={hours}
					class="time-range w-36 sm:w-48"
					style:--day={track}
					aria-label="Time of day"
					aria-valuetext={formatTime(hours)}
				/>
				<span class="w-14 text-center text-[13px] font-semibold">{formatTime(hours)}</span>
				<!-- After dark the lamp button glows softly as a hint -->
				<span class={['rounded-full', !isDay && !lamp && 'ring-2 ring-accent/60']}>
					<IconButton icon="lamp" label="Lights" pressed={lamp} onclick={() => (lamp = !lamp)} />
				</span>
			</FloatingBar>

			<FloatingBar label="Camera" hint="camera">
				<div class="flex max-w-[calc(100vw-12rem)] items-center gap-0.5 overflow-x-auto">
					{#each shots as shot (shot.id)}
						{#if shot.id === corners[0]?.id}
							<span class="flex-none px-1.5 text-xs text-muted">Corners</span>
						{/if}
						<button
							class={chip(activeShot === shot.id && mode !== 'tour')}
							aria-pressed={activeShot === shot.id && mode !== 'tour'}
							aria-label={shot.label}
							onclick={() => goTo(shot.id)}
						>
							{shot.id.startsWith('corner') ? shot.label.replace('Corner ', '') : shot.label}
						</button>
					{/each}
				</div>
				<span class="mx-1 h-5 w-px flex-none bg-line"></span>
				<IconButton
					icon={mode === 'tour' ? 'stop' : 'play'}
					label={mode === 'tour' ? 'Stop tour' : 'Camera tour'}
					pressed={mode === 'tour'}
					onclick={toggleTour}
				/>
				<IconButton icon="maximize" label="Fullscreen" onclick={fullscreen} />
			</FloatingBar>
		</div>
	{/if}

	<!-- Last, so it covers the controls too -->
	<Loader show={!ready && !failed} />
</div>
