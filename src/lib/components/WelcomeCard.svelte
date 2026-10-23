<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './ui/Icon.svelte';

	/** First visit: what the app is for and its three steps. Closing it in any way is for good. */
	let { open }: { open: boolean } = $props();

	const steps = [
		{
			icon: 'cube',
			name: 'Furnish',
			text: 'drag every piece into the room. Move and turn them until everything fits.'
		},
		{
			icon: 'sun',
			name: 'Experience',
			text: 'walk through your room in realistic light. Optional.'
		},
		{
			icon: 'send',
			name: 'Publish',
			text: 'send it into the Duels and make it to the top of the leaderboard!'
		}
	] as const;

	function start() {
		onboarding.closeWelcome();
		if (page.url.pathname !== '/furnish') goto('/furnish');
	}

	function browse() {
		onboarding.closeWelcome();
		goto('/designs');
	}
</script>

<Dialog
	{open}
	title="How would you furnish my room?"
	closable
	onclose={() => onboarding.closeWelcome()}
>
	<p class="text-[14px] text-muted">
		This is my new room in Munich, with the furniture I brought. Arrange it your way and let friends
		decide where they'd rather live.
	</p>
	<ol class="grid gap-3">
		{#each steps as step, i (step.name)}
			<li class="flex items-start gap-3">
				<span
					class="grid size-9 flex-none place-items-center rounded-full bg-accent-soft text-accent"
				>
					<Icon name={step.icon} size={17} />
				</span>
				<p class="pt-0.5 text-[13.5px] leading-snug">
					<span class="font-bold">{i + 1}. {step.name}</span>:
					<span class="text-muted">{step.text}</span>
				</p>
			</li>
		{/each}
	</ol>
	<div class="flex flex-wrap justify-end gap-2 pt-1">
		<button class="btn" onclick={browse}>See what others made</button>
		<!-- The native dialog focuses this first, so Enter starts right away -->
		<!-- svelte-ignore a11y_autofocus -->
		<button class="btn btn-primary" autofocus onclick={start}>Start furnishing</button>
	</div>
</Dialog>
