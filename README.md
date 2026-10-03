# Room Planner

Plan one room in three steps, each on its own page. The room fills the screen; controls float on top of it, and numbers only appear where you are working.

1. **Shape** (`/room`): shape the room right on the floor plan. Drag the right wall (width), the front wall (length), the hallway corner, the doors (move them, or drag their ends for the width), where the glass starts and ends, and the loggia parapet (depth). The part you touch shows its measurements in a small card next to it: drag a value sideways, use the arrow keys or click it to type. Hinge and swing toggle there too. The side panel keeps what the plan can't show (heights, wall thickness, measured status).
2. **Furnish** (`/furnish`): drag furniture from the catalog dock into the room (or click a tile) and arrange it in 3D or on the floor plan. The selected piece gets a floating toolbar (rotate, color, duplicate, details, delete); on the plan it also has resize handles and a rotation knob. Pieces that stick out of the room, overlap or block a door glow red, the blocked door's swing area turns red, and the toolbar says why. The details panel has name, type, color and exact sizes.
3. **Experience** (`/experience`): the closed room, realistically lit, for cinematic shots. Preset viewpoints (door, window, corners, above) with smooth camera glides, a looping camera tour (controls fade out). You always stay inside the room: drag to look, ↑↓ to walk, ←→ to turn, scroll or pinch to zoom; only the "above" shot shows the room from outside.
   - Light: sun and sky follow the time-of-day slider in German clock time (glass front faces east, ~51°N, today's date), daylight through the glass, a warm bounce off the sunlit floor, reflections of the real sky, eye-like exposure adaptation at dusk, and a ceiling lamp.
   - Furniture is modelled by its type: bed, sofa, desk, chair, wardrobe, shelf (with books), nightstand, or a plain box. Older pieces without a type are recognised by name, in English or German (Bett, Schrank, Regal, ...).
   - Details: skirting boards, door casing and light switch, drifting clouds, trees and buildings outside.

## URLs

The URL holds what you are looking at, so Back, reload and links work. `/` reopens the last visited step.

| URL                                         | Meaning                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `/room?focus=door`                          | part being edited: `walls` (default), `door`, `front`, `loggia`, `more` |
| `/furnish?view=plan`                        | floor plan instead of 3D                                                |
| `/furnish?item=<id>`                        | selected piece (Back or Esc deselects)                                  |
| `/furnish?item=<id>&details=1`              | details panel with exact sizes                                          |
| `/experience?shot=window&time=18h30&lamp=1` | viewpoint, clock time, ceiling lamp                                     |
| `/experience?mode=tour`                     | start the camera tour                                                   |

## Shortcuts

The "?" button on each step lists them too.

- Everywhere: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo.
- Shape: drag a grip (Shift: 10 cm steps); click a value to type it, drag it sideways or use the arrow keys.
- Furnish: drag to move (snaps to walls and furniture, Alt: free), arrow keys 1 cm (Shift 10 cm), R rotates 90°, Delete removes, double-click opens details, Esc closes details, then deselects. Plan handles: Shift resizes in 10 cm steps, the knob rotates in 15° steps (Alt: free).
- Experience: WASD or arrow keys walk (in walk mode), drag to look or orbit.

## Design

Soft architectural look: warm paper tones, one sage accent, Manrope, light and dark mode following the system. Colors are CSS variables in `src/routes/layout.css` (the 3D views read them too). Moving between steps cross-fades the pages (View Transitions API); panels and popovers animate in. All motion is switched off with "reduce motion".

Built with SvelteKit (Svelte 5), TailwindCSS v4 and three.js. Runs fully in the browser; data is saved in `localStorage`.

## Develop

```sh
npm install
npm run dev      # dev server
npm run check    # type check
npm run lint     # formatting
npm run build    # Vercel output in .vercel/output/
```

## Structure

```
src/
  routes/
    +layout.svelte        header, step transitions, undo/redo shortcuts, auto-save
    +layout.ts            client-only, prerendered (served statically on Vercel)
    +page.ts              redirects to the last visited step
    room/                 step 1: room shape (part in ?focus=)
    furnish/              step 2: furniture (view, selection and details in the URL, keys)
    experience/           step 3: realistic preview
    layout.css            Tailwind, design tokens (light/dark), step transitions
  lib/
    url.ts                steps, query param and selection helpers
    motion.ts             reduced-motion aware durations
    planner/              plain logic, no UI
      types.ts            RoomConfig, Furniture
      catalog.ts          furniture types and the catalog (typical sizes)
      defaults.ts         starting values and palette
      geometry.ts         room inputs -> clamped geometry, walls, doors
      furniture.ts        footprint math, collision/door checks, edits
      storage.ts          load/save (localStorage)
      planner.svelte.ts   reactive app state (single `planner` instance)
      scene3d.ts          three.js scene of the Furnish step (RoomScene class)
    preview/              realistic preview (three.js)
      PreviewScene.ts     lighting, post-processing, room, scenery, camera glides and tour
      models.ts           parametric furniture models, one per type
      materials.ts        procedural materials (oak, fabric, lacquer, plaster, glass)
      sun.ts              sun position (German clock time), color, slider gradient
      shots.ts            viewpoints derived from the room
      WalkControls.ts     first-person walking
    components/
      Header, Workspace   step navigation; full-screen canvas with floating controls
                          and a side panel (bottom sheet on phones)
      PlanView, Scene3D, Preview
      RoomHandles, RoomCard, RoomSettings              shape step
      CatalogDock, SelectionToolbar, Inspector,
      PieceList, FurnitureIcon                         furnish step
      ui/                 ScrubValue (drag/type number), Segmented, Switch, HelpButton,
                          FloatingBar, IconButton, Icon, ConfirmButton
```

Coordinates are in cm. Origin is the top-left inner corner of the room; y grows towards the loggia. In 3D, plan (x, y) maps to world (x, z).
