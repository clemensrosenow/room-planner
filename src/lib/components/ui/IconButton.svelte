<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		icon: IconName;
		/** Accessible name, also shown as tooltip */
		label: string;
		onclick?: () => void;
		/** Toggle state; omit for plain buttons */
		pressed?: boolean;
		disabled?: boolean;
		tone?: 'default' | 'danger';
	}
	let { icon, label, onclick, pressed, disabled = false, tone = 'default' }: Props = $props();
</script>

<button
	class={[
		'grid size-9 flex-none cursor-pointer place-items-center rounded-full transition-colors disabled:cursor-default disabled:opacity-35 pointer-coarse:size-11',
		pressed
			? 'bg-accent-soft text-accent'
			: tone === 'danger'
				? 'text-warn hover:bg-warn-soft'
				: 'text-ink hover:bg-paper disabled:hover:bg-transparent'
	]}
	aria-label={label}
	title={label}
	aria-pressed={pressed}
	{disabled}
	{onclick}
>
	<Icon name={icon} />
</button>
