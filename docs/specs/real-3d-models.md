# Spec: Real 3D models for existing furniture

Status: Draft · Owner: Clemens · Date: 2026-10-03

## Problem Statement

Every piece in the planner is drawn from a parametric box model (`src/lib/preview/models.ts`), so the Furnish view and the photoreal Experience show "a bed" or "a desk", not _my_ bed and desk. The room already contains specific pieces with known shapes (an IKEA lamp, a desk, two more lamps, a big wardrobe, the bed), and the generic stand-ins make it hard to judge how the room will really look and feel. Lamps are worse: there is no lamp type at all, and the only light source is one hard-coded ceiling light, so evening scenes are not representative.

## Goals

1. **Recognizable room**: the six existing pieces (desk, three lamps, wardrobe, bed) render as their real models in both Furnish and Experience.
2. **Truthful plan**: a piece linked to a model has the model's real footprint and height (±1 cm), so layout decisions stay valid.
3. **Real lighting**: each lamp emits light from its bulb in Experience and can be switched on and off on its own.
4. **Human point of view**: Experience is seen from 180 cm standing / 120 cm sitting, with a field of view that adapts to the window shape and eye-like light adaptation.
5. **Real time**: Experience holds ≥ 30 fps on the laptop with all lamps on.

## Non-Goals

- **In-app model upload**: six fixed pieces don't justify an upload UI and storage. Models are bundled with the site.
- **Phone performance**: only the laptop must run smoothly. The phone layout keeps working, with no fps target.
- **Model sourcing**: finding or building models happens outside the app. Close alternatives are acceptable.
- **IES light profiles**: these give realistic beam shapes, but plain point and spot lights are enough for v1 (see P1).
- **Physics and collision**: walking through furniture stays allowed, as it is today.
- **Editing models in-app**: no material, color or mesh changes. The model is shown as exported.

## User Stories

- As the room owner, I want to link a piece in my plan to a real 3D model so that the preview shows my actual furniture.
- As the room owner, I want a linked piece to take the model's true size so that I can't accidentally plan with wrong dimensions.
- As the room owner, I want to switch individual lamps on and off in the preview so that I can judge evening lighting and which lamp helps where.
- As the room owner, I want one switch for all lights so that I can compare day and night quickly.
- As the room owner, I want to see the room at my eye height, standing and sitting, so that sightlines (window, desk, bed) feel like reality.
- As the room owner, I want to drag real models around in Furnish so that I can rearrange with an accurate impression.
- Edge case: as the room owner, if a model file is missing or still loading, I want the parametric stand-in so that the planner never breaks.
- Edge case: as the room owner, I want to unlink a model so that I can plan a piece I don't own yet with free dimensions.

## Requirements

### P0: Must-have

**R1. Model library (bundled assets)**
Optimized `.glb` files live in `static/models/` and are committed (the license allows it). A typed manifest (e.g. `src/lib/preview/modelLibrary.ts`) lists each model:

```ts
interface ModelEntry {
	id: string; // 'ikea-lamp-pc2014'
	label: string; // shown in the picker
	file: string; // '/models/ikea-lamp-pc2014.glb'
	kind: Kind; // 'lamp' | 'desk' | ...
	size: { w: number; d: number; h: number }; // cm, measured from the exported model
	mount?: 'floor' | 'ceiling'; // default floor
	light?: LampLight; // lamps only, see R5
}
```

Raw sources (FBX, .max, .rar) stay in the gitignored `/models` folder.

- [ ] Every manifest entry loads without errors, and its `size` matches the model's bounding box within 1 cm.
- [ ] A missing file logs one warning, and the piece falls back to its parametric model.

**R2. Asset convention and pipeline**
Each model is exported so that it drops into the existing convention (`buildFurniture`): origin at floor center, width along x, depth along z with the **front facing +z**, y up, meters in the GLB. A short how-to (`docs/models.md`) covers: Blender import → apply scale → set origin → orient front → export GLB → `gltf-transform optimize` (meshopt geometry, WebP/KTX2 textures).

Budget per model: ≤ 100k triangles, textures ≤ 2048 px, file ≤ 5 MB. Total library ≤ 25 MB.

- [ ] All six models are within budget.

**R3. Linking a piece to a model**
`Furniture` gains an optional `model?: string` (manifest id), which is persisted and normalized in `storage.ts` (an unknown id is dropped). The Inspector shows a "Real model" picker listing library entries, with entries of the piece's kind first, plus "None".

- [ ] Picking a model sets the piece's `kind` and replaces its w/d/h with the model's `size`.
- [ ] While linked, the size fields and resize handles are disabled, with a hint "Size from model". Rotation and position stay free.
- [ ] Choosing "None" unlinks the piece and restores editable dimensions (current values kept).

**R4. Shared loader and both views**
One loader (`GLTFLoader` + meshopt decoder) caches each model once and hands out clones to Furnish (`scene3d.ts`) and Experience (`PreviewScene.ts`). While a model loads, the parametric model shows, then gets swapped in.

- Experience: full PBR materials, shadows.
- Furnish: same meshes with the view's simple lighting. Lamps show a glow when on but cast no light.
- [ ] Dragging, rotating and selecting a real model in Furnish behaves the same as with boxes. Hit-testing uses the piece's box, not the mesh.
- [ ] Each model is downloaded once per session, even when shown in both views.

**R5. Lamps as light sources**
A new `lamp` kind is added (catalog, icon, name guess "lamp|leuchte|lampe"), with a parametric fallback model. A lamp's manifest `light` describes its source relative to the model origin:

```ts
interface LampLight {
	pos: [number, number, number]; // cm, bulb position
	type: 'point' | 'spot';
	lumens: number; // from the product page where known
	kelvin: number; // color temperature, e.g. 2700
	shade?: string; // mesh name that glows when on
}
```

In Experience each lamp gets a physical light at `pos`, with intensity from lumens and color from kelvin, and its shade mesh turns emissive when on. The current hard-coded ceiling light becomes a regular lamp piece (`mount: 'ceiling'`), so all lights work the same way.

- [ ] Clicking a lamp in Experience toggles it. One "All lights" switch toggles every lamp.
- [ ] Which lamps are on is part of the URL, like the other Experience state, so a lit scene can be linked and restored.
- [ ] At most 2 lights cast shadows at once (the brightest lit ones near the camera). Others light without shadows. Auto-exposure accounts for all lit lamps.

**R6. Human point of view**

- Eye height is 180 cm standing and 120 cm sitting (replacing the fixed `EYE = 160` in `shots.ts`). A sit/stand toggle (button + key `C`) animates between them.
- Field of view keeps a constant **horizontal** angle (start value 75°, vertical clamped to 35°–65°), so wide and narrow windows show the same width of room without distortion.
- Light adaptation is tuned to ease exposure over ~1.5 s after a big brightness change (lamp on/off, looking at the window) instead of jumping.
- [ ] Resizing the window keeps the horizontal view width constant within the clamps.
- [ ] Sit/stand keeps the camera's floor position and look direction.

**R7. Performance**

- [ ] Experience runs at ≥ 30 fps on the laptop, with all six models placed, all lamps on, at default render quality, measured over a 30 s walk.
- [ ] First Experience load with an empty cache is ≤ 5 s on home broadband, with the room usable earlier on parametric stand-ins.

### P1: Nice-to-have

- **IES profiles** for lamps that ship one (the IKEA lamp includes `010.ies`), via `IESSpotLight`, for realistic beam patterns on walls.
- **Auto-sit**: walking up to the desk or bed offers or switches to sitting height at that spot.
- **Dimmer**: per-lamp brightness slider in the selection toolbar.
- **Model thumbnails** in the picker, rendered once from the GLB.

### P2: Future considerations (design to allow, don't build)

- **In-app import** of GLB files (IndexedDB). This is why `model` is a string id with a manifest lookup rather than a hard-coded import.
- **Wall-mounted pieces** (shelves, sconces): `mount` should be an extensible union, not a boolean.
- **Material variants** (e.g. bedding colors) per model.

## Success Metrics

This is a personal tool, so metrics are checks rather than analytics.

- **Leading (at implementation)**
  - All 6 pieces linked and rendering in both views (target 6/6).
  - Size accuracy ±1 cm against tape-measured real furniture.
  - ≥ 30 fps with all lamps on (stretch: 60 fps).
- **Lagging (after use)**
  - Side-by-side check: a photo of the real room vs a preview from the same spot and eye height, judged "recognizably the same room".
  - Next rearrangement decision made from the preview without measuring again by hand.

## Open Questions

| #   | Question                                                                                                                                     | Who              | Blocking?                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------- |
| 1   | Lumens and color temperature for each lamp (product pages or bulb packaging)                                                                 | Clemens          | No: default 800 lm / 2700 K |
| 2   | Are any lamps wall-mounted or desk-top (sitting on the desk)? Desk-top lamps need a placement height above the floor.                        | Clemens          | Yes, for R5 placement       |
| 3   | Is 75° horizontal FOV right, or does it feel too wide or narrow in practice? Tune after first build.                                         | Clemens (design) | No                          |
| 4   | Is there a model for the ceiling light too, or does it stay parametric?                                                                      | Clemens          | No                          |
| 5   | Do the IKEA FBX materials survive conversion (V-Ray/Corona materials in the .max don't carry over)? Textures may need re-linking in Blender. | Engineering      | No, but affects R2 effort   |

## Timeline and Phasing

No hard deadlines. Suggested order, each phase shippable on its own:

1. **Static models**: R1–R4 for desk, wardrobe and bed (no lights needed). Proves the pipeline and both views.
2. **Lamps**: `lamp` kind, R5 lights, toggles, URL state, shadow budget, ceiling light migration.
3. **Point of view**: R6 eye heights, FOV, adaptation, then the R7 performance pass with everything in.

Dependency: phases 1–2 need the GLB exports, which depend on model sourcing (in progress).
