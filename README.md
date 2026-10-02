# Room Planner

Interactive planner for one room: enter the room dimensions, add furniture boxes and arrange them in a 3D view or a 2D floor plan. Warns when a piece sticks out of the room, overlaps another piece or blocks a door's swing area.

Shortcuts: drag to move (snaps to walls/furniture, hold Alt for free), arrow keys move 1 cm (Shift 10 cm), R rotates 90°, Esc deselects, Ctrl+Z / Ctrl+Shift+Z undo/redo.

**Preview** tab: closed, realistically lit room for cinematic shots. Preset viewpoints (door, window, corners, above) with smooth camera glides, a looping camera tour and a first-person walk mode. Sun and sky follow the time-of-day slider (glass front faces east, ~51°N, today's date); ceiling lamp toggle.

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
    +page.svelte          page layout, toolbar, keyboard shortcuts, auto-save
    +layout.ts            client-only, prerendered (static)
    layout.css            Tailwind + color tokens (light/dark)
  lib/
    planner/              plain logic, no UI
      types.ts            RoomConfig, Furniture
      defaults.ts         starting values and palette
      geometry.ts         room inputs -> clamped geometry, walls, doors
      furniture.ts        footprint math, collision/door checks, edits
      storage.ts          load/save (localStorage)
      planner.svelte.ts   reactive app state (single `planner` instance)
      scene3d.ts          three.js scene (RoomScene class)
    preview/              realistic preview (three.js)
      PreviewScene.ts     lighting, materials, room, camera glides and tour
      WalkControls.ts     first-person walking
      shots.ts            viewpoints derived from the room
      sun.ts              sun position and color by time of day
      materials.ts        procedural textures (wood, plaster, concrete)
    components/
      Header.svelte, PlanView.svelte, Scene3D.svelte, Preview.svelte
      RoomSettings.svelte, FurnitureList.svelte, FurnitureCard.svelte
      ui/                 NumberField, SelectField, Section, ConfirmButton
```

Coordinates are in cm. Origin is the top-left inner corner of the room; y grows towards the loggia. In 3D, plan (x, y) maps to world (x, z).
