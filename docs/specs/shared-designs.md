# Spec: Shared Designs, Likes and Leaderboard

Status: Ready to build · Owner: Clemens · Date: 2026-10-03

Vocabulary follows [CONTEXT.md](../../CONTEXT.md). Decisions: [ADR 0001](../adr/0001-device-identity-without-accounts.md), [ADR 0002](../adr/0002-fixed-room-and-inventory.md), [ADR 0003](../adr/0003-immutable-published-designs-in-postgres.md).

## Problem Statement

The planner is single-player: one Draft in `localStorage`, nobody else can see it. I want friends to find the best way to furnish **my** room: each one arranges the same real furniture, publishes a Design, shares it by link, likes others' Designs and remixes them. The best ones rise to the top of a Leaderboard.

## Goals

1. **Comparable**: every Design arranges the same Room and the same Inventory, so the Leaderboard compares like with like.
2. **Zero friction**: no sign-up. Viewing, liking and publishing work on the first visit.
3. **Reliable**: a Published Design looks the same forever, and invalid or conflicting Designs can't be published (enforced on the server too).
4. **Shareable**: a short readable link that opens straight into the 3D view and unfurls nicely in chats.

## Non-Goals

- Accounts, login, multi-device ownership (ADR 0001).
- More than one Room, editing the Room, free catalog furniture (ADR 0002).
- Editing a Published Design (ADR 0003). Publish again instead.
- Multiple local Drafts or a "My designs" page.
- Comments, follows, notifications, realtime updates.
- Anti-fraud and rate limiting. Friend-scale; revisit if abused.
- Per-design OG images, 3D screenshot thumbnails.
- Search-engine indexing (`noindex` everywhere public).

## User Stories

- As a friend, I open a shared link and see the Design in 3D right away, without touching my own Draft.
- As a friend, I like a Design with one tap and can undo it.
- As a friend, I browse the Leaderboard by Top (default) or New.
- As a friend, I remix a Design I like, change it, and publish my version with credit to the original.
- As a designer, I publish my Draft with a title (a nice suggestion is pre-filled) and an optional name, then share the link.
- As a designer, I delete something I published by mistake.
- Edge case: my Draft has Conflicts. Publish is disabled and tells me how many to fix.
- Edge case: I remix while having unsaved work. A dialog warns me before my Draft is replaced.
- Edge case: the Design I remixed from was deleted. My Design says "Remix of a deleted design".
- Edge case: a link to a deleted or unknown Design shows a friendly 404 with a link to the Leaderboard.

## Requirements

### R1. Room and Inventory (code, not data)

- New module `src/lib/planner/room.ts` exporting `ROOM_ID = 'clemens-v1'`, `ROOM: RoomConfig` (current measured values) and `INVENTORY: Piece[]`.
- `Piece` = `{ id, name, kind, w, d, h, color, model? }`: the six real pieces from [real-3d-models.md](real-3d-models.md) (desk, three lamps, wardrobe, bed). Sizes and colors are fixed.
- A Design's furniture is derived: `INVENTORY` merged with `placements: Record<pieceId, { cx, cy, rot }>`.
- The Draft is always a full placement of the Inventory. Missing Pieces from an old Draft get a default placement; unknown ones are dropped.

- [ ] The Shape step (`/room`) is gone from the step nav. `/room` redirects to `/furnish`.
- [ ] Furnish has no catalog dock, add, duplicate, delete, resize, recolor or rename. Move, rotate and selection stay.
- [ ] Changing `ROOM` or `INVENTORY` in code requires a new `ROOM_ID`.

### R2. Device identity

- `deviceId`: `crypto.randomUUID()`, created lazily, stored in `localStorage` (`room-planner-device`).
- Sent as header `X-Device-Id` on every API call. The server stores only `sha256(deviceId)`.
- The Designer name used last is remembered in `localStorage` (`room-planner-designer`).

### R3. Database (Neon Postgres + Drizzle)

```ts
designs: {
  id:            text primary key,        // 8-char nanoid, URL-safe, lowercase
  roomId:        text not null,           // 'clemens-v1'
  title:         text not null,           // 1–60 chars, trimmed
  designer:      text,                    // 0–30 chars, trimmed, null = Anonymous
  placements:    jsonb not null,          // Record<pieceId, { cx, cy, rot }>
  remixedFromId: text references designs(id) on delete set null,
  remixedFromTitle:    text,              // denormalized for "Remix of X by Y"
  remixedFromDesigner: text,
  publisherHash: text not null,
  likeCount:     integer not null default 0,
  createdAt:     timestamptz not null default now(),
}
index (roomId, likeCount desc, createdAt desc)
index (roomId, createdAt desc)

likes: {
  designId:  text references designs(id) on delete cascade,
  likerHash: text,
  createdAt: timestamptz default now(),
  primary key (designId, likerHash)
}
```

- `likeCount` is updated in the same transaction as the insert or delete of the Like row.
- Deleted source: `remixedFromId` becomes null, but the title and designer stay, so the UI can tell "deleted" (id null, title present) from "not a remix" (both null).
- Env: `DATABASE_URL` from the Vercel Neon integration. Drizzle migrations live in `drizzle/`, with `npm run db:generate` / `db:migrate`.

### R4. API (SvelteKit `+server.ts`, all JSON)

| Method & path                            | Does                                                                        | Errors                     |
| ---------------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| `GET /api/designs?sort=top\|new&cursor=` | Leaderboard page (24), each with `likedByMe`, `mine`                        |                            |
| `GET /api/designs/:id`                   | One Design, with `likedByMe`, `mine`                                        | 404                        |
| `POST /api/designs`                      | Publish `{ title, designer?, placements, remixedFromId? }` → `{ id, slug }` | 400 invalid, 422 conflicts |
| `DELETE /api/designs/:id`                | Only if `publisherHash` matches                                             | 403, 404                   |
| `PUT /api/designs/:id/like`              | Like (idempotent) → `{ likeCount }`                                         | 403 own, 404               |
| `DELETE /api/designs/:id/like`           | Unlike (idempotent) → `{ likeCount }`                                       | 404                        |

Server-side validation on publish:

- [ ] The title is 1–60 chars after trimming, and the designer is ≤ 30 chars.
- [ ] The placement keys equal the `INVENTORY` ids exactly. Values are finite numbers, and `rot` is normalized to [0, 360).
- [ ] **Zero Conflicts**, re-checked with the same `checkFurniture` / `computeGeometry` code the client uses. That code must stay free of DOM/three imports.
- [ ] `remixedFromId`, if given, must exist (otherwise it's silently dropped). Its title and designer are copied.
- [ ] A missing `X-Device-Id` → 400.

### R5. Draft changes

- The Draft gets `remixedFrom?: { id, title, designer }`, kept until the next publish and then cleared.
- Storage schema v1 → v2: keep placements of known Pieces and drop the rest (R1).
- **Remix** (from a Design page): if the Draft differs from the Inventory's default placement, a confirm dialog appears: "Replace your current design? This can't be undone." On confirm, placements are copied, `remixedFrom` is set, and you land on `/furnish`.

### R6. Publish flow

- The **Publish** primary button sits in the header on Furnish and Experience.
- It is disabled while any Conflict exists, with a tooltip like "Resolve 2 conflicts first". Clicking the disabled button selects the first conflicting Piece.
- The dialog has:
  - **Title**: empty input whose placeholder is a generated Airbnb-style name ("Sunlit Loft with Garden View", "Cozy Nook by the Window"). Submitting empty uses the placeholder. Re-roll button 🎲.
  - **Your name (optional)**: pre-filled from the last one used. Empty means "Anonymous".
  - Remix line when relevant: "Remix of _X_ by Y".
- On success, you go to `/d/<id>-<slug>?published=1`, which opens the share sheet once ("Published! Share it with friends") and then removes the param.
- On failure, the error shows inline in the dialog (network, 422 conflicts), and the draft stays untouched.

Title generator: `src/lib/social/titles.ts`. It picks from adjective × noun × feature lists (e.g. _Sunlit / Cozy / Airy / Quiet_ × _Loft / Nook / Retreat / Studio_ × _with Loggia View / by the Window / for Night Owls_), and the result is ≤ 60 chars.

### R7. Design page `/d/[id]-[slug]`

- Loaded server-side (`+page.server.ts`). An unknown id gives a 404 page with a link to `/designs`. A wrong slug gives a 301 redirect to the canonical slug.
- It reuses Experience read-only and opens on the `above` shot. Existing `shot`, `time`, `lamp`, `mode` params work. A toggle switches to a read-only PlanView (no handles, no toolbar).
- Top bar:
  - title, "by Designer" or "Anonymous", relative time
  - remix line linking the parent, or "Remix of a deleted design"
  - **Like** toggle with count (hidden and replaced by a "Yours" badge if `mine`)
  - **Remix**
  - **Share** (`navigator.share`, falling back to copy + toast "Link copied")
  - **Delete** if `mine` (confirm button)
- Like is optimistic: it flips instantly and rolls back with a toast on error.
- Head: `noindex`, `og:title` = title, `og:description` = "by X · N likes · Furnish Clemens's room", `og:image` = one static room render in `static/og.jpg`.

### R8. Leaderboard `/designs`

- Tabs: **Top** (default, no param) and **New** (`?sort=new`).
- Top orders by likeCount desc, then createdAt desc. New orders by createdAt desc. Cursor pagination with a "Load more" button.
- Card: plan thumbnail (an SVG rendered from the Room plus placements, reusing plan geometry, with no images stored), title, designer, Like toggle with count, relative time, "Yours" badge, remix marker.
  - The whole card links to the Design page, and the Like button stops propagation.
- Empty state: "No designs yet. Be the first", linking to `/furnish`.
- The header gets a **Designs** link next to the steps. `noindex`.

### R9. Slugs

- `slugify(title)`: lowercase ASCII, umlauts transliterated (ä→ae), non-alphanumerics become `-`, max 40 chars. Never stored, always derived. The id alone is authoritative.

## Out-of-scope follow-ups (P2)

Per-design OG image · rate limiting · claim designs with email · multiple Rooms with Room picker · multiple local Drafts · "Hot" sort.

## Open item

- Confirm the six Inventory Pieces and their exact sizes match the model manifest from `real-3d-models` once that lands. Sizes come from the models, not from guesses.
