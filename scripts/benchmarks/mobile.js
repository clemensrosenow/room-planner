import { PreviewScene } from './PreviewScene.ts';
import { PreviewScene as Baseline } from './PreviewScene.baseline.ts';
import { GEO, INVENTORY } from '../planner/room.ts';
import { MODELS } from '../planner/catalog.ts';
import { loadModel } from './modelLoader.ts';
import { loadModel as loadBaselineModel } from './modelLoader.baseline.ts';
import { makeShots } from './shots.ts';

// Explicitly select the existing phone path; viewport resizing alone does not emulate touch.
const media = window.matchMedia.bind(window);
window.matchMedia = (q) => {
	const m = media(q);
	if (q === '(pointer: coarse)') Object.defineProperty(m, 'matches', { value: true });
	return m;
};
Object.defineProperty(screen, 'width', { value: 390, configurable: true });
Object.defineProperty(screen, 'height', { value: 844, configurable: true });
await Promise.all(Object.keys(MODELS).flatMap((id) => [loadModel(id), loadBaselineModel(id)]));
const furn = INVENTORY.map((p, i) => ({
	...p,
	cx: 80 + (i % 3) * 140,
	cy: 90 + Math.floor(i / 3) * 130,
	rot: 0
}));
export function show(variant = 'baseline', width = 390, height = 844) {
	window.shown?.dispose();
	document.querySelector('#bench')?.remove();
	const el = document.createElement('div');
	el.id = 'bench';
	el.style.cssText = `width:${width}px;height:${height}px;position:fixed;top:0;left:0`;
	document.body.append(el);
	const s = (window.shown = new (variant === 'baseline' ? Baseline : PreviewScene)(el));
	cancelAnimationFrame(s.frame);
	s.resizeObserver.disconnect();
	s.renderer.domElement.style.cssText = 'width:100%;height:100%';
	s.build(GEO, furn);
	s.goTo(makeShots(GEO)[0], true);
	s.update(1);
	s.updateEnvironment(performance.now());
	s.sky.material.uniforms.time.value = 0;
	return s;
}
export async function measure(s, samples = 48, moving = false, batchSize = 8) {
	const gl = s.renderer.getContext(),
		ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
	if (!ext) throw Error('GPU queries unavailable');
	for (let i = 0; i < 120; i++) s.composer.render();
	if (s.renderer.info.programs.some((p) => p.diagnostics?.runnable === false))
		throw Error('Shader compilation failed');
	if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL error before measurement');
	const queries = [],
		cpu = [],
		intervals = [],
		draws = [],
		tris = [];
	let previous = performance.now();
	s.renderer.info.autoReset = false;
	if (moving) s.startTour(makeShots(GEO).filter((x) => !x.cutaway));
	for (let i = 0; i < samples; i++) {
		await new Promise(requestAnimationFrame);
		const now = performance.now();
		intervals.push(now - previous);
		previous = now;
		s.renderer.info.reset();
		const q = gl.createQuery();
		gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
		const t = performance.now();
		for (let frame = 0; frame < batchSize; frame++) {
			if (moving) s.update(1 / 60);
			s.composer.render();
		}
		cpu.push((performance.now() - t) / batchSize);
		gl.endQuery(ext.TIME_ELAPSED_EXT);
		queries.push(q);
		draws.push(s.renderer.info.render.calls / batchSize);
		tris.push(s.renderer.info.render.triangles / batchSize);
	}
	const calls = draws.reduce((a, b) => a + b, 0) / samples,
		triangles = tris.reduce((a, b) => a + b, 0) / samples;
	s.renderer.info.autoReset = true;
	for (
		let i = 0;
		i < 120 && !queries.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE));
		i++
	)
		await new Promise(requestAnimationFrame);
	if (gl.getParameter(ext.GPU_DISJOINT_EXT)) throw Error('Disjoint GPU samples');
	if (!queries.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)))
		throw Error('Incomplete GPU samples');
	const gpu = queries
		.map((q) => gl.getQueryParameter(q, gl.QUERY_RESULT) / (1e6 * batchSize))
		.sort((a, b) => a - b);
	queries.forEach((q) => gl.deleteQuery(q));
	cpu.sort((a, b) => a - b);
	intervals.sort((a, b) => a - b);
	return {
		samples,
		batchSize,
		phone: s.phone,
		size: [gl.drawingBufferWidth, gl.drawingBufferHeight],
		gpuMedianMs: gpu[samples >> 1],
		gpuP95Ms: gpu[Math.floor(samples * 0.95)],
		gpuMaxMs: gpu.at(-1),
		cpuMedianMs: cpu[samples >> 1],
		cpuP95Ms: cpu[Math.floor(samples * 0.95)],
		batchFps: 1000 / (intervals.reduce((a, b) => a + b, 0) / samples),
		frameP95Ms: intervals[Math.floor(samples * 0.95)],
		calls,
		triangles
	};
}
export function capture(s, width = 390, height = 844) {
	s.composer.render();
	const c = document.createElement('canvas');
	c.width = width;
	c.height = height;
	const ctx = c.getContext('2d');
	ctx.drawImage(s.renderer.domElement, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height).data;
}
export function compare(a, b, width = 390, height = 844) {
	let mae = 0,
		ssim = 0,
		n = 0,
		max = 0;
	for (let y = 0; y < height; y += 8)
		for (let x = 0; x < width; x += 8) {
			let sx = 0,
				sy = 0,
				sxx = 0,
				syy = 0,
				sxy = 0,
				count = 0;
			for (let dy = 0; dy < 8 && y + dy < height; dy++)
				for (let dx = 0; dx < 8 && x + dx < width; dx++) {
					const i = ((y + dy) * width + x + dx) * 4;
					let p = 0,
						q = 0;
					for (let c = 0; c < 3; c++) {
						const d = Math.abs(a[i + c] - b[i + c]);
						mae += d;
						max = Math.max(max, d);
						const w = [0.2126, 0.7152, 0.0722][c];
						p += a[i + c] * w;
						q += b[i + c] * w;
					}
					sx += p;
					sy += q;
					sxx += p * p;
					syy += q * q;
					sxy += p * q;
					count++;
				}
			const mx = sx / count,
				my = sy / count;
			ssim +=
				((2 * mx * my + 6.5025) * (2 * (sxy / count - mx * my) + 58.5225)) /
				((mx * mx + my * my + 6.5025) * (sxx / count - mx * mx + syy / count - my * my + 58.5225));
			n++;
		}
	return { rgbMAE: mae / (width * height * 3), maxChannelError: max, ssim: ssim / n };
}
window.show = show;
window.measure = measure;
window.capture = capture;
window.compare = compare;
export async function run({ samples = 48, repeats = 2, width = 390, height = 844 } = {}) {
	const references = [],
		results = [];
	window.progress = [];
	for (let repeat = 0; repeat < repeats; repeat++)
		for (const variant of repeat % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']) {
			const s = show(variant, width, height);
			for (const [index, [shot, hours, lamp, moving]] of [
				['door', 10, false, false],
				['window', 10, false, false],
				['above', 10, false, false],
				['door', 21.5, true, false],
				['door', 10, false, true]
			].entries()) {
				s.setMode('walk');
				s.goTo(
					makeShots(GEO).find((x) => x.id === shot),
					true
				);
				s.setTime(hours);
				s.setLamp(lamp);
				s.update(1);
				s.updateEnvironment(performance.now());
				s.sky.material.uniforms.time.value = 0;
				for (let i = 0; i < 60; i++) {
					s.composer.render();
					await new Promise(requestAnimationFrame);
				}
				const result = await measure(s, samples, moving);
				// Compare a matched static pose after measuring motion.
				s.setMode('walk');
				s.goTo(
					makeShots(GEO).find((x) => x.id === shot),
					true
				);
				s.update(1);
				s.sky.material.uniforms.time.value = 0;
				const pixels = capture(s, width, height);
				if (variant === 'baseline' && repeat === 0) references[index] = pixels;
				results.push({
					repeat,
					variant,
					shot,
					hours,
					lamp,
					moving,
					...result,
					quality: references[index] ? compare(references[index], pixels, width, height) : null
				});
				window.progress.push({ repeat, variant, shot, moving });
			}
		}
	window.shown.dispose();
	window.shown = null;
	document.querySelector('#bench')?.remove();
	return {
		baseline: '4478db13b0c21f8ac58297b139057aaf2cad2210',
		width,
		height,
		slowdown: { gpu: 8, cpu: 10 },
		results
	};
}
window.run = run;
