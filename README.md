# Room Planner

Interactive planner for one room, in three steps:

1. **Shape** (`/room`): room dimensions, doors, glass front and loggia.
2. **Furnish** (`/furnish`): add furniture boxes and arrange them in 3D or a 2D floor plan. Warns when a piece sticks out of the room, overlaps another piece or blocks a door's swing area.
3. **Experience** (`/experience`): realistic preview.

The URL holds what you are looking at, so Back, reload and links work:

| URL                  | Meaning                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `/room?focus=door`   | open section: `walls` (default), `door`, `front`, `loggia`, `more` |
| `/furnish?view=plan` | floor plan instead of 3D                                           |
| `/furnish?item=<id>` | selected piece (Back or Esc deselects)                             |

`/` reopens the last visited step.

Shortcuts: drag to move (snaps to walls/furniture, hold Alt for free), arrow keys move 1 cm (Shift 10 cm), R rotates 90°, Esc deselects, Ctrl+Z / Ctrl+Shift+Z undo/redo.

**Experience**: closed, realistically lit room for cinematic shots. Preset viewpoints (door, window, corners, above) with smooth camera glides, a looping camera tour (controls fade out) and a first-person walk mode.

- Light: sun and sky follow the time-of-day slider in German clock time (glass front faces east, ~51°N, today's date), daylight through the glass, a warm bounce off the sunlit floor, reflections of the real sky, eye-like exposure adaptation at dusk, and a ceiling lamp.
- Furniture is modelled by name: bed, sofa, desk, chair, wardrobe, shelf (with books), nightstand; anything else stays a soft box. Works with German names too (Bett, Schrank, Regal, ...).
- Room details: skirting boards, door casing and light switch, drifting clouds, trees and buildings outside.

Built with SvelteKit (Svelte 5), TailwindCSS v4 and three.js. Runs fully in the browser; data is saved in `localStorage`.

## Develop

```sh
npm install
npm run dev      # dev server
npm run check    # type check
npm run build    # static site in build/
```

## Structure

```
src/
  routes/
    +layout.svelte        header with step navigation, undo/redo shortcuts, auto-save
    +layout.ts            client-only, prerendered (static)
    +page.ts              redirects to the last visited step
    room/                 step 1: room shape
    furnish/              step 2: furniture (view + selection in the URL, move/rotate keys)
    experience/           step 3: realistic preview
    layout.css            Tailwind + design tokens (warm palette, light/dark)
  lib/
    url.ts                steps, query param and selection helpers
    planner/              plain logic, no UI
      types.ts            RoomConfig, Furniture
      defaults.ts         starting values and palette
      geometry.ts         room inputs -> clamped geometry, walls, doors
      furniture.ts        footprint math, collision/door checks, edits
      storage.ts          load/save (localStorage)
      planner.svelte.ts   reactive app state (single `planner` instance)
      scene3d.ts          three.js scene (RoomScene class)
    preview/              realistic preview (three.js)
      PreviewScene.ts     lighting, post-processing, room, scenery, camera glides and tour
      models.ts           parametric furniture models, picked by name
      WalkControls.ts     first-person walking
      shots.ts            viewpoints derived from the room
      sun.ts              sun position (German clock time), color, slider gradient
      materials.ts        procedural materials (oak, fabric, lacquer, plaster, glass)
    components/
      Header.svelte, Workspace.svelte (full-screen canvas, floating
                            controls, side panel / bottom sheet)
      PlanView.svelte, Scene3D.svelte, Preview.svelte
      RoomSettings.svelte, FurnitureList.svelte, FurnitureCard.svelte
      ui/                 ScrubValue (drag/type number), Segmented, Switch,
                            FloatingBar, IconButton, Icon, ConfirmButton
```

Coordinates are in cm. Origin is the top-left inner corner of the room; y grows towards the loggia. In 3D, plan (x, y) maps to world (x, z).
