// Serve a built static deployment with the production-startup probe injected.
// Optional latency applies per response, including models, JS and document.
// Benchmark use only: no server routes or database requests are forwarded.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 4173);
const latency = Number(process.argv[4] ?? 0);
const bandwidth = Number(process.argv[5] ?? 0);
const sidecarMode = process.argv[6];
const responses = [];
if (bandwidth > 0) {
	// One shared round-robin budget across requests, approximating a limited link.
	setInterval(
		() => {
			const next = responses.shift();
			if (!next || next.res.destroyed) return;
			const end = Math.min(next.offset + 16384, next.body.length);
			next.res.write(next.body.subarray(next.offset, end));
			if (end === next.body.length) next.res.end();
			else responses.push({ ...next, offset: end });
		},
		(16384 * 8) / (bandwidth * 1000)
	).unref();
}
const probe = await readFile(new URL('./startup-probe.js', import.meta.url), 'utf8');
const types = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.glb': 'model/gltf-binary',
	'.svg': 'image/svg+xml'
};
http
	.createServer(async (req, res) => {
		try {
			let path = resolve(
				root,
				'.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
			);
			if (!path.startsWith(root + '/')) throw Error('Invalid path');
			try {
				if ((await stat(path)).isDirectory()) path += '/index.html';
			} catch {
				path += '.html';
			}
			let body = await readFile(path);
			if (path.endsWith('.glb.gz')) {
				if (sidecarMode === 'missing') throw Error('Missing sidecar');
				if (sidecarMode === 'corrupt') body = Buffer.from('Invalid gzip');
				if (sidecarMode === 'encoded') res.setHeader('Content-Encoding', 'gzip');
			}
			const ext = extname(path);
			if (ext === '.html')
				body = Buffer.from(
					body.toString().replace('<head>', '<head><script>' + probe + '</script>')
				);
			const zipped =
				/gzip/.test(req.headers['accept-encoding'] ?? '') &&
				['.js', '.html', '.css', '.json'].includes(ext);
			if (zipped) body = gzipSync(body);
			if (latency) await new Promise((r) => setTimeout(r, latency));
			res.writeHead(200, {
				'Content-Type': types[ext] ?? 'application/octet-stream',
				...(zipped && { 'Content-Encoding': 'gzip' }),
				'Content-Length': body.length,
				'Cache-Control': 'no-store'
			});
			if (bandwidth > 0) responses.push({ res, body, offset: 0 });
			else res.end(body);
		} catch {
			res.writeHead(404);
			res.end();
		}
	})
	.listen(port, '127.0.0.1', () =>
		console.log(`Startup build: http://127.0.0.1:${port}/experience?phone`)
	);
