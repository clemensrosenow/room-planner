<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { PreviewScene, type CameraMode } from '#lib/preview/PreviewScene.ts';
	import { makeShots } from '#lib/preview/shots.ts';
	import { formatTime } from '#lib/preview/sun.ts';
	import { onMount } from 'svelte';

	let wrap: HTMLDivElement;
	let container: HTMLDivElement;
	let scene = $state<PreviewScene | null>(null);
	let failed = $state(false);

	let mode = $state<CameraMode>('orbit');
	let activeShot = $state('door');
	let hours = $state(9);
	let lamp = $state(false);

	const shots = $derived(makeShots(planner.geo));

	onMount(() => {
		try {
			scene = new PreviewScene(container);
		} catch {
			failed = true;
			return;
		}
		scene.onModeChange = (m) => {
			mode = m;
			if (m !== 'tour') activeShot = '';
		};
		return () => scene?.dispose();
	});

	// Rebuild when the room or furniture changes; start at the door
	let placed = false;
	$effect(() => {
		const s = scene;
		if (!s) return;
		s.build(planner.geo, $state.snapshot(planner.furn));
		if (!placed) {
			placed = true;
			s.goTo(shots[0]);
		}
	});
	$effect(() => scene?.setTime(hours));
	$effect(() => scene?.setLamp(lamp));

	function goTo(id: string) {
		const shot = shots.find((s) => s.id === id);
		if (!shot || !scene) return;
		activeShot = id;
		scene.goTo(shot);
		mode = 'orbit';
	}

	function toggleTour() {
		if (!scene) return;
		if (mode === 'tour') {
			scene.setMode('orbit');
			mode = 'orbit';
		} else {
			scene.startTour(shots.filter((s) => !s.cutaway));
			mode = 'tour';
			activeShot = '';
		}
	}

	function toggleWalk() {
		if (!scene) return;
		if (mode === 'walk') {
			scene.setMode('orbit');
			mode = 'orbit';
		} else {
			scene.setMode('walk');
			scene.walkFrom(shots.find((s) => s.id === activeShot && !s.cutaway) ?? shots[0]);
			mode = 'walk';
		}
	}

	function fullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else wrap.requestFullscreen?.();
	}

	const pad: [string, string, string][] = [
		['arrowup', '▲', 'col-start-2'],
		['arrowleft', '◀', 'col-start-1 row-start-2'],
		['arrowdown', '▼', 'col-start-2 row-start-2'],
		['arrowright', '▶', 'col-start-3 row-start-2']
	];
</script>

<div bind:this={wrap} class="relative h-full w-full bg-black">
	<div bind:this={container} class="h-full w-full"></div>

	{#if failed}
		<div class="absolute inset-0 grid place-items-center p-5 text-center text-white/70">
			The preview needs WebGL, which this browser doesn't support.
		</div>
	{:else}
		<!-- Camera shots -->
		<div
			class="absolute inset-x-2 top-2 flex flex-wrap gap-1.5 text-xs text-white [&_button]:cursor-pointer [&_button]:rounded-full [&_button]:bg-black/45 [&_button]:px-3 [&_button]:py-1 [&_button]:backdrop-blur [&_button:hover]:bg-black/65"
		>
			{#each shots as shot (shot.id)}
				<button
					class={[activeShot === shot.id && mode === 'orbit' && 'ring-2 ring-white/80']}
					onclick={() => goTo(shot.id)}>{shot.label}</button
				>
			{/each}
			<span class="flex-1"></span>
			<button class={[mode === 'tour' && 'ring-2 ring-white/80']} onclick={toggleTour}>
				{mode === 'tour' ? '■ Stop tour' : '▶ Tour'}
			</button>
			<button class={[mode === 'walk' && 'ring-2 ring-white/80']} onclick={toggleWalk}>
				{mode === 'walk' ? '✕ Stop walking' : '🚶 Walk'}
			</button>
			<button onclick={fullscreen} aria-label="Fullscreen">⛶</button>
		</div>

		<!-- Lighting -->
		<div
			class="absolute bottom-2 left-2 flex flex-wrap items-center gap-3 rounded-lg bg-black/45 px-3 py-2 text-xs text-white backdrop-blur"
		>
			<label class="flex items-center gap-2">
				<span aria-hidden="true">☀</span>
				<input
					type="range"
					min="5"
					max="21.5"
					step="0.25"
					bind:value={hours}
					class="w-32 accent-white sm:w-44"
					aria-label="Time of day"
				/>
				<span class="w-10 font-mono tabular-nums">{formatTime(hours)}</span>
			</label>
			<label class="flex cursor-pointer items-center gap-1.5">
				<input type="checkbox" bind:checked={lamp} class="accent-white" /> Ceiling lamp
			</label>
		</div>

		{#if mode === 'walk'}
			<div class="absolute right-2 bottom-2 flex flex-col items-end gap-1.5">
				<span class="rounded bg-black/45 px-2 py-1 text-[11px] text-white/80 backdrop-blur">
					Drag to look · WASD / arrows to walk
				</span>
				<div class="grid grid-cols-3 gap-1">
					{#each pad as [key, icon, pos] (key)}
						<button
							class="{pos} h-10 w-10 cursor-pointer rounded-md bg-black/45 text-white backdrop-blur select-none active:bg-black/70"
							aria-label="Walk {key.replace('arrow', '')}"
							onpointerdown={() => scene?.press(key, true)}
							onpointerup={() => scene?.press(key, false)}
							onpointerleave={() => scene?.press(key, false)}>{icon}</button
						>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
