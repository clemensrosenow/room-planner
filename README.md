# Room Planner

Interactive planner for one room, in three steps:

1. **Shape** (`/room`): room dimensions, doors, glass front and loggia.
2. **Furnish** (`/furnish`): drag furniture from the catalog dock into the room (or click a tile) and arrange it in 3D or a 2D floor plan. The selected piece gets a floating toolbar (rotate, color, duplicate, details, delete); in the plan it also has resize handles and a rotation knob. Pieces that stick out of the room, overlap or block a door glow red, the blocked door's swing area turns red, and the toolbar says why.
3. **Experience** (`/experience`): realistic preview.

The URL holds what you are looking at, so Back, reload and links work:

| URL                                         | Meaning                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `/room?focus=door`                          | open section: `walls` (default), `door`, `front`, `loggia`, `more` |
| `/furnish?view=plan`                        | floor plan instead of 3D                                           |
| `/furnish?item=<id>`                        | selected piece (Back or Esc deselects)                             |
| `/furnish?item=<id>&details=1`              | details panel with exact sizes                                     |
| `/experience?shot=window&time=18h30&lamp=1` | viewpoint, clock time, ceiling lamp                                |
| `/experience?mode=tour`                     | start the camera tour (or `walk`)                                  |

`/` reopens the last visited step.

Shortcuts: drag to move (snaps to walls/furniture, hold Alt for free), arrow keys move 1 cm (Shift 10 cm), R rotates 90°, Delete removes, double-click opens details, Esc closes details / deselects, Ctrl+Z / Ctrl+Shift+Z undo/redo. Plan handles: Shift resizes in 10 cm steps, the knob rotates in 15° steps (Alt: free).

**Experience**: closed, realistically lit room for cinematic shots. Preset viewpoints (door, window, corners, above) with smooth camera glides, a looping camera tour (controls fade out) and a first-person walk mode.

- Light: sun and sky follow the time-of-day slider in German clock time (glass front faces east, ~51°N, today's date), daylight through the glass, a warm bounce off the sunlit floor, reflections of the real sky, eye-like exposure adaptation at dusk, and a ceiling lamp.
- Furniture is modelled by its type (set in the catalog or details panel): bed, sofa, desk, chair, wardrobe, shelf (with books), nightstand, or a plain box. Older pieces without a type are recognised by name, in English or German (Bett, Schrank, Regal, ...).
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
      catalog.ts          furniture types and the catalog (typical sizes)
      defaults.ts         starting values and palette
      geometry.ts         room inputs -> clamped geometry, walls, doors
      furniture.ts        footprint math, collision/door checks, edits
      storage.ts          load/save (localStorage)
      planner.svelte.ts   reactive app state (single `planner` instance)
      scene3d.ts          three.js scene (RoomScene class)
    preview/              realistic preview (three.js)
      PreviewScene.ts     lighting, post-processing, room, scenery, camera glides and tour
      models.ts           parametric furniture models, one per type
      WalkControls.ts     first-person walking
      shots.ts            viewpoints derived from the room
      sun.ts              sun position (German clock time), color, slider gradient
      materials.ts        procedural materials (oak, fabric, lacquer, plaster, glass)
    components/
      Header.svelte, Workspace.svelte (full-screen canvas, floating
                            controls, side panel / bottom sheet)
      PlanView.svelte, Scene3D.svelte, Preview.svelte
      RoomSettings.svelte
      CatalogDock, SelectionToolbar, Inspector, PieceList, FurnitureIcon
      ui/                 ScrubValue (drag/type number), Segmented, Switch,
                            FloatingBar, IconButton, Icon, ConfirmButton
```

Coordinates are in cm. Origin is the top-left inner corner of the room; y grows towards the loggia. In 3D, plan (x, y) maps to world (x, z).
