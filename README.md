# Room Planner

Interactive planner for one room: enter the room dimensions, add furniture boxes and arrange them in a 3D view or a 2D floor plan. Warns when a piece sticks out of the room, overlaps another piece or blocks a door's swing area.

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
    components/
      Header.svelte, PlanView.svelte, Scene3D.svelte
      RoomSettings.svelte, FurnitureList.svelte, FurnitureCard.svelte
      ui/                 NumberField, SelectField, Section, ConfirmButton
```

Coordinates are in cm. Origin is the top-left inner corner of the room; y grows towards the loggia. In 3D, plan (x, y) maps to world (x, z).
