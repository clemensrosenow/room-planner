# Room Planner

Find the best way to furnish one real room. Everyone arranges the same Room with the same real furniture (the Inventory), publishes a Design, shares it by link, likes and remixes the others. The best rise to the top of the Leaderboard. Vocabulary: [CONTEXT.md](CONTEXT.md), decisions: [docs/adr](docs/adr), spec: [docs/specs/shared-designs.md](docs/specs/shared-designs.md).

1. **Furnish** (`/furnish`): arrange the pieces in 3D or on the floor plan. Pieces can only be moved and turned: their sizes and colors are the real ones. The selected piece gets a floating toolbar (rotate, exact position); on the plan it also has a rotation knob. Pieces that stick out of the room, overlap or block a door are Conflicts: they glow red, the blocked door's swing area turns red, and the toolbar says why.
2. **Experience** (`/experience`): the closed room, realistically lit, for cinematic shots. Preset viewpoints (door, window, corners, above) with smooth camera glides, a looping camera tour (controls fade out). You always stay inside the room: drag to look, ↑↓ to walk, ←→ to turn, scroll or pinch to zoom; only the "above" shot shows the room from outside.
   - Light: sun and sky follow the time-of-day slider in German clock time (glass front faces east, ~51°N, today's date), daylight through the glass, a warm bounce off the sunlit floor, reflections of the real sky, eye-like exposure adaptation at dusk, and a ceiling lamp.
   - Furniture is modelled by its type, or shown as its real 3D model where one exists.
3. **Publish** (header, on both steps): give the Draft a title (a suggestion is pre-filled, 🎲 for another) and optionally your name. Disabled while there are Conflicts; clicking it then selects the first one. Publishing leads to the Design's page with a share dialog.
4. **Designs** (`/designs`): the Leaderboard, Top (most likes) or New. A Design page (`/d/<id>-<slug>`) shows it in 3D or as a plan, read-only, with Like, Remix (copies it into your Draft, after a warning if that would replace your own work), Share and, for your own, Delete.

No accounts: a random id in `localStorage` identifies the browser (Device). It publishes, likes (once per Design, not your own) and deletes what it published. Clearing site data makes a new Device.

The Room and Inventory are defined in code (`src/lib/planner/room.ts`) under one `ROOM_ID`. Changing measurements or furniture means a new `ROOM_ID`, which starts a fresh Leaderboard.

## URLs

The URL holds what you are looking at, so Back, reload and links work. `/` reopens the last visited step.

| URL                                         | Meaning                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `/furnish?view=plan`                        | floor plan instead of 3D                                               |
| `/furnish?item=<id>`                        | selected piece (Back or Esc deselects)                                 |
| `/furnish?item=<id>&details=1`              | details panel with exact position                                      |
| `/experience?shot=window&time=18h30&lamp=1` | viewpoint, clock time, ceiling lamp                                    |
| `/experience?mode=tour`                     | start the camera tour                                                  |
| `/designs?sort=new`                         | Leaderboard, newest first (Top without the param)                      |
| `/d/<id>-<slug>?view=plan`                  | a Published Design as a plan (3D without; `shot`, `time`, `lamp` work) |

## Shortcuts

The "?" button on each step lists them too.

- Everywhere: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo.
- Furnish: drag to move (snaps to walls and furniture, Alt: free), arrow keys 1 cm (Shift 10 cm), R rotates 90°, double-click opens the exact position, Esc closes it, then deselects. On the plan the knob rotates in 15° steps (Alt: free).
- Experience: WASD or arrow keys walk (in walk mode), drag to look or orbit.

## Design

Soft architectural look: warm paper tones, one sage accent, Manrope, light and dark mode following the system. Colors are CSS variables in `src/routes/layout.css` (the 3D views read them too). Moving between steps cross-fades the pages (View Transitions API); panels and popovers animate in. All motion is switched off with "reduce motion".

Built with SvelteKit (Svelte 5), TailwindCSS v4 and three.js. The Draft is saved in `localStorage`; Published Designs and Likes live in Neon Postgres (Drizzle ORM), served by small JSON endpoints.

## Develop

```sh
npm install
vercel env pull .env.local   # DATABASE_URL from the Vercel Neon integration
npm run db:migrate           # create or update the tables
npm run dev                  # dev server
npm run check                # type check
npm run lint                 # formatting
npm run build                # Vercel output in .vercel/output/
```

After changing `src/lib/server/schema.ts`, run `npm run db:generate` to add a migration in `drizzle/`, then `npm run db:migrate`. Without `DATABASE_URL` the planner still works; only sharing (the API, Designs pages) fails.

### API

All JSON; every call sends the header `X-Device-Id` (the server stores only its sha256).

| Method & path                    | Does                                                                        | Errors             |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| `GET /api/designs?sort=&cursor=` | Leaderboard page (24), each with `likedByMe`, `mine`, `nextCursor`          | 400 bad cursor     |
| `GET /api/designs/:id`           | One Design                                                                  | 404                |
| `POST /api/designs`              | Publish `{ title, designer?, placements, remixedFromId? }` → `{ id, slug }` | 400, 422 conflicts |
| `DELETE /api/designs/:id`        | Only by the Device that published it                                        | 403, 404           |
| `PUT /api/designs/:id/like`      | Like (idempotent) → `{ likeCount }`                                         | 403 own, 404       |
| `DELETE /api/designs/:id/like`   | Unlike (idempotent) → `{ likeCount }`                                       | 404                |

## Structure

```
src/
  routes/
    +layout.svelte        header, step transitions, undo/redo shortcuts, auto-save, toasts
    +layout.ts            client-only, prerendered (served statically on Vercel)
    +page.ts              redirects to the last visited step
    +error.svelte         friendly 404 with a link to the Leaderboard
    room/                 old Shape step, redirects to /furnish
    furnish/              step 1: arrange (view, selection and details in the URL, keys)
    experience/           step 2: realistic preview
    designs/              Leaderboard (client-side, Top / New)
    d/[ref]/              a Published Design (server-rendered for link previews)
    api/designs/          JSON API
    layout.css            Tailwind, design tokens (light/dark), step transitions
  lib/
    url.ts                steps, query param and selection helpers
    motion.ts             reduced-motion aware durations
    toast.svelte.ts       short messages ("Link copied")
    planner/              plain logic, no UI (shared with the server: no DOM or three imports
                          except scene3d.ts)
      room.ts             ROOM_ID, the Room, the Inventory, placements, Conflict check
      types.ts            RoomConfig, Furniture
      catalog.ts          furniture types and real 3D models
      defaults.ts         palette
      geometry.ts         room inputs -> clamped geometry, walls, doors
      furniture.ts        footprint math, Conflict checks (walls, doors, overlaps), moves
      storage.ts          the Draft in localStorage (schema 2, migrates schema 1)
      planner.svelte.ts   reactive Draft state (single `planner` instance)
      scene3d.ts          three.js scene of the Furnish step (RoomScene class)
    preview/              realistic preview (three.js)
      PreviewScene.ts     lighting, post-processing, room, scenery, camera glides and tour
      models.ts           parametric furniture models, one per type
      materials.ts        procedural materials (oak, fabric, lacquer, plaster, glass)
      sun.ts              sun position (German clock time), color, slider gradient
      shots.ts            viewpoints derived from the room
      WalkControls.ts     first-person walking
    social/               sharing, used by client and server
      types.ts            DesignData, limits
      api.ts              API client (adds X-Device-Id)
      device.ts           Device id and last Designer name (localStorage)
      slug.ts, titles.ts  URL slugs, title suggestions
      format.ts           relative time, "Anonymous"
    server/               server only
      schema.ts, db.ts    Drizzle tables, Neon connection
      designs.ts          validation, queries, Likes
    components/
      Header, Workspace   navigation, Publish; full-screen canvas with floating controls
                          and a side panel (bottom sheet on phones)
      PlanView, Scene3D, Preview                       (PlanView and Preview also read-only)
      SelectionToolbar, Inspector, PieceList, FurnitureIcon   furnish step
      PublishButton, PublishDialog                     publishing the Draft
      DesignView, DesignCard, PlanThumb, LikeButton    Design page and Leaderboard
      ui/                 ScrubValue (drag/type number), Segmented, Switch, HelpButton,
                          FloatingBar, IconButton, Icon, ConfirmButton, Dialog, Toaster
```

Coordinates are in cm. Origin is the top-left inner corner of the room; y grows towards the loggia. In 3D, plan (x, y) maps to world (x, z).
