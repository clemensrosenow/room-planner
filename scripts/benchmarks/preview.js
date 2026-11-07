// Dev-only browser benchmark. See docs/preview-performance.md for setup and usage.
import { PreviewScene } from '/src/lib/preview/PreviewScene.ts';
import { PreviewScene as Baseline } from '/src/lib/preview/PreviewScene.baseline.ts';
import { GEO, INVENTORY } from '/src/lib/planner/room.ts';
import { MODELS } from '/src/lib/planner/catalog.ts';
import { loadModel } from '/src/lib/preview/modelLoader.ts';
import { makeShots } from '/src/lib/preview/shots.ts';

function compare(a, b) {
	let error = 0,
		max = 0,
		ssim = 0,
		count = 0;
	for (let start = 0; start < a.length; start += 256) {
		const x = [],
			y = [];
		for (let i = start; i < Math.min(start + 256, a.length); i += 4) {
			x.push(a[i] * 0.2126 + a[i + 1] * 0.7152 + a[i + 2] * 0.0722);
			y.push(b[i] * 0.2126 + b[i + 1] * 0.7152 + b[i + 2] * 0.0722);
			for (let c = 0; c < 3; c++) {
				const d = Math.abs(a[i + c] - b[i + c]);
				error += d;
				max = Math.max(max, d);
			}
		}
		const mx = x.reduce((s, v) => s + v, 0) / x.length,
			my = y.reduce((s, v) => s + v, 0) / y.length;
		let vx = 0,
			vy = 0,
			cov = 0;
		x.forEach((v, i) => {
			vx += (v - mx) ** 2;
			vy += (y[i] - my) ** 2;
			cov += (v - mx) * (y[i] - my);
		});
		vx /= x.length;
		vy /= x.length;
		cov /= x.length;
		ssim +=
			((2 * mx * my + 6.5025) * (2 * cov + 58.5225)) /
			((mx * mx + my * my + 6.5025) * (vx + vy + 58.5225));
		count++;
	}
	return { rgbMAE: error / (a.length * 0.75), maxChannelError: max, stripSSIM: ssim / count };
}

export async function run({ samples = 60, furnished = true } = {}) {
	// Stop the normal preview so only the measured scene uses the GPU.
	if (window.previewScene) cancelAnimationFrame(window.previewScene.frame);
	await Promise.all(Object.keys(MODELS).map(loadModel));
	const host = document.createElement('div');
	host.style.cssText = 'position:fixed;inset:0;width:1280px;height:800px;z-index:99999';
	document.body.append(host);
	// Repeatable workload: every Piece, distributed through the Room; no database access.
	const furn = furnished
		? INVENTORY.map((p, i) => ({
				...p,
				cx: 80 + (i % 3) * 140,
				cy: 90 + Math.floor(i / 3) * 130,
				rot: 0
			}))
		: [];
	const shots = makeShots(GEO),
		cases = [
			['door', 10, false],
			['window', 10, false],
			['overview', 10, false],
			['door', 21.5, true]
		];
	window.benchmarkProgress = [];
	const results = [],
		references = [];
	for (const variant of ['baseline', 'shadows', 'msaa', 'optimized']) {
		const s = new (variant === 'baseline' || variant === 'shadows' ? Baseline : PreviewScene)(host);
		cancelAnimationFrame(s.frame);
		s.resizeObserver.disconnect();
		s.build(GEO, furn);
		const gl = s.renderer.getContext(),
			ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
		if (!ext) throw new Error('GPU timer queries unavailable');
		if (variant === 'shadows') s.renderer.shadowMap.autoUpdate = false;
		if (variant === 'msaa') s.ao.setSize(1600, 1000);
		for (const [index, [shot, hours, lamp]] of cases.entries()) {
			s.goTo(shots.find((x) => x.id === shot) || shots.find((x) => x.cutaway), true);
			s.renderer.shadowMap.needsUpdate = true;
			s.setTime(hours);
			s.setLamp(lamp);
			s.update(1);
			s.updateEnvironment(performance.now());
			s.sky.material.uniforms.time.value = 0;
			for (let i = 0; i < 8; i++) s.composer.render();
			const queries = [],
				intervals = [];
			let prev = performance.now();
			s.renderer.info.autoReset = false;
			for (let i = 0; i < samples; i++) {
				await new Promise(requestAnimationFrame);
				intervals.push(performance.now() - prev);
				prev = performance.now();
				s.renderer.info.reset();
				const q = gl.createQuery();
				gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
				s.composer.render();
				gl.endQuery(ext.TIME_ELAPSED_EXT);
				queries.push(q);
			}
			const calls = s.renderer.info.render.calls,
				triangles = s.renderer.info.render.triangles;
			await new Promise((r) => setTimeout(r, 200));
			const times = queries
				.filter((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))
				.map((q) => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
				.sort((a, b) => a - b);
			queries.forEach((q) => gl.deleteQuery(q));
			s.composer.render();
			// Compare the displayed image at the same CSS dimensions for both pixel ratios.
			const canvas = document.createElement('canvas');
			canvas.width = 1280;
			canvas.height = 800;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(s.renderer.domElement, 0, 0, 1280, 800);
			const pixels = ctx.getImageData(0, 0, 1280, 800).data;
			if (variant === 'baseline') references[index] = pixels;
			window.benchmarkProgress.push([variant, shot]);
			results.push({
				variant,
				shot,
				hours,
				lamp,
				samples: times.length,
				gpuMedianMs: times[times.length >> 1],
				gpuP95Ms: times[Math.floor(times.length * 0.95)],
				fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
				calls,
				triangles,
				disjoint: gl.getParameter(ext.GPU_DISJOINT_EXT),
				quality: compare(references[index], pixels)
			});
		}
		s.dispose();
	}
	host.remove();
	return { viewport: [1280, 800], dpr: { baseline: 1.5, optimized: 1.25 }, furnished, results };
}
