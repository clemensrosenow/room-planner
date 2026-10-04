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

/** Soft surface noise shared by plaster, fabric and lacquer bump maps. */
let grain: THREE.Texture | null = null;
const surfaceGrain = () => (grain ??= texture(noise(256, 128, 60, 5), false));

/** Low-frequency blotches (smoothly upscaled noise), safe from moiré at grazing angles. */
let blotches: THREE.Texture | null = null;
function softGrain() {
	if (blotches) return blotches;
	const small = noise(48, 128, 90, 23);
	blotches = texture(
		canvas(256, (x) => {
			x.imageSmoothingQuality = 'high';
			x.drawImage(small, 0, 0, 256, 256);
		}),
		false
	);
	return blotches;
}

/** Matte wall paint with a faint, uneven roller texture. */
export function plaster(color = 0xf2efe9) {
	const bumpMap = softGrain().clone();
	bumpMap.repeat.set(1 / 60, 1 / 60);
	return new THREE.MeshStandardMaterial({ color, roughness: 0.93, bumpMap, bumpScale: 0.04 });
}

export function concrete() {
	const map = texture(noise(256, 170, 40, 11));
	map.repeat.set(1 / 100, 1 / 100);
	return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
}

/** Window glass: almost invisible, but reflects the sky at grazing angles. */
export const glass = () =>
	new THREE.MeshPhysicalMaterial({
		color: 0xeef6f8,
		transparent: true,
		opacity: 0.08,
		roughness: 0,
		metalness: 0,
		ior: 1.5,
		specularIntensity: 1,
		envMapIntensity: 1.5,
		depthWrite: false
	});

/** Powder-coated aluminium window frames. */
export const frame = () => new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.4 });

export const doorLeaf = () => new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.4 });

/** Satin white trim for skirting boards, door casings and switch plates. */
export const trim = () => new THREE.MeshStandardMaterial({ color: 0xf8f7f4, roughness: 0.45 });

export const steel = () =>
	new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.3, metalness: 1 });

/**
 * Light oak with long grain, for tabletops, frames and legs. The texture covers 120 cm. `pale` is
 * white-stained oak, as on wardrobe sides.
 */
export function oak(pale = false) {
	const rnd = random(19);
	const size = 512;
	const c = canvas(size, (x) => {
		x.fillStyle = pale ? 'rgb(222,206,182)' : 'rgb(196,160,118)';
		x.fillRect(0, 0, size, size);
		for (let i = 0; i < 90; i++) {
			x.strokeStyle = `rgba(${pale ? '150,120,85' : '120,80,40'},${0.04 + rnd() * 0.1})`;
			x.lineWidth = 0.5 + rnd() * 2;
			const y = rnd() * size;
			x.beginPath();
			x.moveTo(0, y);
			x.bezierCurveTo(
				size / 3,
				y + (rnd() - 0.5) * 14,
				(2 * size) / 3,
				y + (rnd() - 0.5) * 14,
				size,
				y
			);
			x.stroke();
		}
	});
	const map = texture(c);
	map.repeat.set(1 / 120, 1 / 120);
	return new THREE.MeshStandardMaterial({ map, roughness: 0.5 });
}

/**
 * Mirror glass. The environment map only holds the sky, so a true mirror would reflect a dark
 * void; half metal, half bright diffuse reads as a mirror showing a light room.
 */
export const mirror = () =>
	new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.16, metalness: 0.5 });

/** Polished chrome tube. */
export const chrome = () =>
	new THREE.MeshStandardMaterial({ color: 0xe6e8eb, roughness: 0.2, metalness: 0.7 });

/** Anodised aluminium profiles, e.g. sliding door frames. */
export const aluminium = () =>
	new THREE.MeshStandardMaterial({ color: 0xc4c7ca, roughness: 0.35, metalness: 0.9 });

/** High-gloss white lacquer. */
export const glossWhite = () =>
	new THREE.MeshPhysicalMaterial({
		color: 0xf4f2ec,
		roughness: 0.15,
		clearcoat: 1,
		clearcoatRoughness: 0.05
	});

/** Woven upholstery in a color (sRGB hex). */
export function fabric(color: number) {
	const bumpMap = surfaceGrain().clone();
	bumpMap.repeat.set(1 / 6, 1 / 6);
	return new THREE.MeshPhysicalMaterial({
		color,
		roughness: 0.95,
		bumpMap,
		bumpScale: 0.4,
		// Soft rim light on fibres, the key look of upholstery
		sheen: 0.6,
		sheenRoughness: 0.7,
		sheenColor: new THREE.Color(0xffffff)
	});
}

/** Satin painted wood (cabinet fronts) in a color (sRGB hex). */
export const lacquer = (color: number) =>
	new THREE.MeshStandardMaterial({ color, roughness: 0.42 });

/** White bed linen. */
export function linen() {
	const bumpMap = surfaceGrain().clone();
	bumpMap.repeat.set(1 / 8, 1 / 8);
	return new THREE.MeshStandardMaterial({
		color: 0xf4f1ea,
		roughness: 0.97,
		bumpMap,
		bumpScale: 0.3
	});
}

/** Book spines in muted colors. */
export const BOOK_COLORS = [
	0x6b4f3a, 0x8c3b2e, 0x2f4a5a, 0x5d6b4a, 0xc9b48a, 0x3d3a36, 0xa86a3c, 0xe2ddd2
];
