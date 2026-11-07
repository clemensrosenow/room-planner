// Browser QA after cold-interactions.js completes. Uses a separate, hidden
// preview, current cached models and no persistent Draft/database changes.
window.coldLifecycle = null;
void (async () => {
	const code = await (await fetch('/src/lib/components/Preview.svelte')).text();
	const path = code.match(/["']([^"']*\/preview\/PreviewScene\.ts[^"']*)["']/)[1];
	const { PreviewScene } = await import(path);
	const { GEO, INVENTORY } = await import('/src/lib/planner/room.ts');
	const { makeShots } = await import('/src/lib/preview/shots.ts');
	const furn = INVENTORY.map((p, i) => ({
		...p,
		cx: 80 + (i % 3) * 140,
		cy: 90 + Math.floor(i / 3) * 130,
		rot: 0
	}));
	const el = document.createElement('div');
	el.style.cssText = 'position:fixed;width:390px;height:844px;visibility:hidden';
	document.body.append(el);
	const scene = new PreviewScene(el);
	try {
		scene.build(GEO, furn);
		scene.goTo(makeShots(GEO)[0], true);
		const compile = scene.beauty.compileAsync.bind(scene.beauty);
		function gateNextCompile() {
			let enter, release;
			const entered = new Promise((resolve) => (enter = resolve));
			const wait = new Promise((resolve) => (release = resolve));
			let first = true;
			scene.beauty.compileAsync = async (...args) => {
				const pending = compile(...args);
				if (first) {
					first = false;
					enter();
					await wait;
				}
				return pending;
			};
			return { entered, release };
		}
		const gate = gateNextCompile();
		const first = scene.prepare();
		const samePromise = first === scene.prepare();
		await gate.entered;
		scene.setTime(18.5);
		scene.setLamp(true);
		scene.build(
			GEO,
			furn.map((p, i) => ({ ...p, cx: p.cx + (i === 0 ? 10 : 0) }))
		);
		gate.release();
		const ready = await first;
		const rebuild = {
			ready,
			samePromise,
			isPrepared: scene.isPrepared,
			latestBuild: scene.preparedVersion === scene.buildVersion,
			latestTime: scene.hours === 18.5,
			latestLamp: scene.lampOn && scene.lampLights.every((l) => l.visible)
		};
		const disposedGate = gateNextCompile();
		scene.build(GEO, furn);
		const pending = scene.prepare();
		await disposedGate.entered;
		scene.dispose();
		disposedGate.release();
		const disposed = (await pending) === false && !scene.isPrepared;
		window.coldLifecycle = { rebuild, disposed };
	} finally {
		if (!scene.disposed) scene.dispose();
		el.remove();
	}
})().catch((error) => (window.coldLifecycle = { error: String(error), stack: error.stack }));
