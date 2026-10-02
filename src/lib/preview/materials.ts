import * as THREE from 'three';

/** Procedural textures, so the preview needs no image assets. */

function canvas(size: number, draw: (x: CanvasRenderingContext2D, size: number) => void) {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	draw(c.getContext('2d')!, size);
	return c;
}

/** Deterministic pseudo random numbers, so textures look the same on every build. */
function random(seed: number) {
	return () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
}

function texture(c: HTMLCanvasElement, color = true) {
	const t = new THREE.CanvasTexture(c);
	if (color) t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = 8;
	return t;
}

/** Fine grain noise around a base gray level. */
function noise(size: number, base: number, spread: number, seed: number) {
	const rnd = random(seed);
	return canvas(size, (x) => {
		const img = x.createImageData(size, size);
		for (let i = 0; i < img.data.length; i += 4) {
			const v = base + (rnd() - 0.5) * spread;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
			img.data[i + 3] = 255;
		}
		x.putImageData(img, 0, 0);
	});
}

/** Oak planks, 20 cm wide, 120 cm long. The texture covers 240 × 240 cm. */
export function woodFloor() {
	const rnd = random(7);
	const size = 1024;
	const px = size / 240; // pixels per cm
	const c = canvas(size, (x) => {
		for (let row = 0; row < 12; row++) {
			const offset = ((row * 37) % 120) * px;
			for (let k = -1; k < 3; k++) {
				const x0 = offset + k * 120 * px;
				const y0 = row * 20 * px;
				const l = 0.85 + rnd() * 0.25;
				x.fillStyle = `rgb(${178 * l},${142 * l},${104 * l})`;
				x.fillRect(x0, y0, 120 * px, 20 * px);
				// Grain lines along the plank
				for (let g = 0; g < 14; g++) {
					x.strokeStyle = `rgba(90,55,25,${0.05 + rnd() * 0.12})`;
					x.lineWidth = 0.6 + rnd() * 1.4;
					const gy = y0 + rnd() * 20 * px;
					x.beginPath();
					x.moveTo(x0, gy);
					x.bezierCurveTo(
						x0 + 40 * px,
						gy + (rnd() - 0.5) * 6,
						x0 + 80 * px,
						gy + (rnd() - 0.5) * 6,
						x0 + 120 * px,
						gy
					);
					x.stroke();
				}
				// Seams
				x.fillStyle = 'rgba(60,35,15,.55)';
				x.fillRect(x0, y0, 1.5, 20 * px);
			}
			x.fillStyle = 'rgba(60,35,15,.55)';
			x.fillRect(0, row * 20 * px, size, 1.5);
		}
	});
	const map = texture(c);
	map.repeat.set(1 / 240, 1 / 240);
	return new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0 });
}

export const plaster = (color = 0xf1eee8) =>
	new THREE.MeshStandardMaterial({ color, roughness: 0.95 });

export function concrete() {
	const map = texture(noise(256, 170, 40, 11));
	map.repeat.set(1 / 100, 1 / 100);
	return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
}

export const glass = () =>
	new THREE.MeshPhysicalMaterial({
		color: 0xdfeef5,
		transparent: true,
		opacity: 0.12,
		roughness: 0.02,
		metalness: 0,
		depthWrite: false
	});

export const frame = () =>
	new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.45, metalness: 0.3 });

export const doorLeaf = () => new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.45 });

/** Furniture colors matching the planner palette (light theme). */
const FURNITURE = [0xc49f72, 0x86a1c2, 0x90b18f, 0xc69292, 0xa99ac4];
let fabric: THREE.Texture | null = null;

export function furniture(color: number) {
	fabric ??= texture(noise(128, 128, 50, 5), false);
	return new THREE.MeshStandardMaterial({
		color: FURNITURE[color % FURNITURE.length],
		roughness: 0.8,
		bumpMap: fabric,
		bumpScale: 0.3
	});
}
