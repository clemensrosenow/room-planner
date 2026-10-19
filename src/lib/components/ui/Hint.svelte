<script lang="ts" module>
	import { createSubscriber } from 'svelte/reactivity';

	/** Where `[data-hint=…]` is on screen. It can move every frame (the selected Piece's toolbar), so it's re-measured every frame while shown. */
	class TargetRect {
		#rect: DOMRect | null = null;
		#subscribe;

		constructor(selector: string) {
			this.#subscribe = createSubscriber((update) => {
				let last = '';
				let frame = 0;
				const measure = () => {
					// Several elements can carry the same target (the toolbar floats on desktop and is docked on phones): use the visible one
					let visible: DOMRect | null = null;
					for (const el of document.querySelectorAll(selector)) {
						const r = el.getBoundingClientRect();
						if (r.width > 0 && r.height > 0) {
							visible = r;
							break;
						}
					}
					const key = visible ? `${visible.x},${visible.y},${visible.width},${visible.height}` : '';
					if (key !== last) {
						last = key;
						this.#rect = visible;
						update();
					}
					frame = requestAnimationFrame(measure);
				};
				measure();
				return () => cancelAnimationFrame(frame);
			});
		}

		get current() {
			this.#subscribe();
			return this.#rect;
		}
	}
</script>

<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import Icon from './Icon.svelte';

	/**
	 * Small non-modal card with an arrow pointing at a control marked `data-hint={target}`. It follows
	 * the control while it moves, never takes focus, and Esc closes it before anything else.
	 */
	interface Props {
		target: string;
		title?: string;
		/** Preferred side of the target; it flips when there is no room */
		prefer?: 'above' | 'below';
		/** A hand moving up from the target, as if dragging it (not with reduced motion) */
		gesture?: boolean;
		children: Snippet;
		/** Extra buttons before "Got it" */
		actions?: Snippet;
		onclose: () => void;
	}
	let { target, title, prefer, gesture = false, children, actions, onclose }: Props = $props();

	const GAP = 14;
	const MARGIN = 12;

	const target$ = $derived(new TargetRect(`[data-hint="${target}"]`));
	let cardH = $state(0);
	let vw = $state(0);
	let vh = $state(0);

	const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

	const place = $derived.by(() => {
		const rect = target$.current;
		if (!rect || !vw) return null;
		const width = Math.min(296, vw - 2 * MARGIN);
		const fitsAbove = rect.top - GAP - cardH >= MARGIN;
		const fitsBelow = rect.bottom + GAP + cardH <= vh - MARGIN;
		const side = prefer ?? (rect.top + rect.height / 2 > vh / 2 ? 'above' : 'below');
		const above = side === 'above' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
		const cx = rect.left + rect.width / 2;
		const left = clamp(cx - width / 2, MARGIN, vw - width - MARGIN);
		return {
			width,
			left,
			top: above ? rect.top - GAP - cardH : rect.bottom + GAP,
			above,
			arrow: clamp(cx - left, 22, width - 22),
			cx,
			cy: rect.top + rect.height / 2
		};
	});
</script>

<svelte:window
	bind:innerWidth={vw}
	bind:innerHeight={vh}
	onkeydowncapture={(e) => {
		if (e.key !== 'Escape' || !place) return;
		e.preventDefault();
		onclose();
	}}
/>

{#if place}
	{#if gesture}
		<span
			class="hint-hand pointer-events-none fixed z-40 -translate-x-1/2 text-ink drop-shadow"
			style:left="{place.cx}px"
			style:top="{place.cy}px"
			aria-hidden="true"
		>
			<Icon name="hand" size={30} />
		</span>
	{/if}
	<aside
		transition:fly={{ y: place.above ? 6 : -6, duration: duration(160) }}
		data-onboarding
		class={[
			'pointer-events-auto fixed z-40 grid gap-2 rounded-2xl bg-sheet p-4 text-[13px] shadow-float ring-1 ring-line/70',
			!cardH && 'invisible'
		]}
		style:left="{place.left}px"
		style:top="{place.top}px"
		style:width="{place.width}px"
		bind:clientHeight={cardH}
		aria-label="Tip"
	>
		<span
			class={[
				'absolute size-3 -translate-x-1/2 rotate-45 bg-sheet',
				place.above ? '-bottom-1.5' : '-top-1.5'
			]}
			style:left="{place.arrow}px"
		></span>
		<div role="status" class="grid gap-1">
			{#if title}<p class="text-[14px] font-bold">{title}</p>{/if}
			<p class="leading-snug text-ink/85">{@render children()}</p>
		</div>
		<div class="flex flex-wrap justify-end gap-1.5 pt-1">
			{@render actions?.()}
			<button class="btn" onclick={onclose}>Got it</button>
		</div>
	</aside>
{/if}

<style>
	/* Three times: from the target up into the room, fading out */
	.hint-hand {
		animation: hint-drag 1.2s ease-in-out 3 both;
	}
	@keyframes hint-drag {
		0% {
			opacity: 0;
			transform: translate(-50%, 0);
		}
		15% {
			opacity: 1;
			transform: translate(-50%, 0);
		}
		75% {
			opacity: 1;
			transform: translate(-50%, -150px);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -170px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hint-hand {
			display: none;
		}
	}
</style>
