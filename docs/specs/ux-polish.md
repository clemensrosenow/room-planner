# Spec: UX polish before launch

Status: Draft · Owner: Clemens · Date: 2026-10-23

Vocabulary follows [CONTEXT.md](../../CONTEXT.md). Decisions: [ADR 0002](../adr/0002-fixed-room-and-inventory.md) (Piece names change, ids don't, so the Leaderboard stays), [ADR 0004](../adr/0004-duels-replace-likes.md). Replaces parts of [shared-designs.md](shared-designs.md), [onboarding.md](onboarding.md) and [duels.md](duels.md), listed under [Superseded](#superseded).

## Problem Statement

The site is about to go to friends, and a few things get in the way:

- The copy is anonymous ("this room"), but it's my real room in Munich with my furniture.
- Sharing a single Design is pushed as a step, but Duels on the site already decide which Design is best. The step adds nothing.
- On phones the header doesn't read as a sequence of steps, Publish is a tiny `3/9` at the edge, and the nav stretches (`max-md:flex-1`) for no reason.
- Dragging a Piece from the dock into the room breaks off halfway.
- The help popover runs off the right edge of the screen, and on phones it lists keyboard shortcuts.
- The 3D / Plan switch is icon-only on phones and gets lost among the other tool buttons.
- "Kallax" and other brand names mean nothing to most people.
- The ✕ that puts a Piece back looks like it closes the selection toolbar.
- Opening a Piece's exact-position panel on a phone ends in an internal error, and the panel adds little.
- Low walls, room dimensions and the recenter button add buttons, not value.
- Experience opens on the door, and the view from above, the best overview, comes last.

## Goals

1. A friend understands within one screen whose room this is and what to do.
2. Furnish → Experience → Publish reads as three steps on every screen width, and Publish is always visible.
3. A Piece dragged from the dock is never lost and the drag is never cut off by accident.
4. The Furnish toolbar only has controls people use.

## Non-Goals

- No new features, no changes to the Room, the Inventory's ids, sizes or colors, the database or the API.
- No sharing replacement (no copy-link button anywhere). Design pages keep their URLs; the Leaderboard links to them.
- No camera reset of any kind (no button, no double-tap).

## Delivery

Three PRs from `main`, in this order. Each shows the commands it ran with their output, and screenshots on a phone width (≈375 px) and desktop for UI changes.

1. **Drag fix**: R1.
2. **Removals, toolbar and header**: R2–R6.
3. **Copy, sharing and names**: R7–R9.

## Requirements

### R1. Dragging from the dock (PR 1)

Today the dock tile unmounts as soon as its Piece is placed, because `planner.unplaced` no longer contains it (`InventoryDock.svelte`). The tile held the pointer capture, so the drag stops. On touch, the tile's `touch-pan-x` lets the browser take a sideways gesture for scrolling the dock, which fires `pointercancel`.

- The tile of the Piece being dragged stays mounted, dimmed, until the drag ends. It keeps the pointer capture the whole time. The same holds for the last Piece: the dock doesn't unmount mid-drag.
- **Axis decision**: after 6 px of movement, a mostly horizontal movement (|dx| > |dy|) scrolls the dock and starts no drag. Any other direction starts a drag. From then on the browser can't take the gesture (`touch-action: none` on the tile while dragging, capture kept).
- While dragging over the room, the Piece shows under the pointer and follows it, as today.
- **Release** over the dock or outside the room: the Piece goes back to the dock (unplaced, nothing selected).
- **`pointercancel`** (system gesture, call, etc.): the Piece stays where it last was, placed and selected. If it never entered the room, it stays in the dock.
- A click without movement still drops the Piece in the middle of the room.

Tested: the axis decision is a pure function, e.g. `dragAxis(dx, dy): 'pending' | 'scroll' | 'drag'` next to the dock code, with a `*.test.ts`.

- [ ] Dragging a Piece from the dock to the far side of the room on a phone and on desktop never stops halfway.
- [ ] A sideways swipe on the dock scrolls it; an upward or diagonal one drags.
- [ ] Releasing over the dock puts the Piece back.
- [ ] Dragging the last Piece of the dock works the same.

### R2. Removed (PR 2)

Removed together with their code, props and state:

- **Exact position panel**: `Inspector.svelte`, the `?details` URL param (`openDetails`, `closeDetails`, the `details` branch of `selectItem` and of Esc), double-click / `onopen` in `Scene3D` and `PlanView`, the sliders button in `SelectionToolbar`, `ScrubValue.svelte` if nothing else uses it, and the `panel` / `title` / `sub` / `onclose` parts of `Workspace` if nothing else uses them.
- **Low walls**: the button and `lowWalls` in `Scene3D` / `scene3d.ts`.
- **Room dimensions**: the ruler button and `showDims` in `Scene3D`, `PlanView`, `scene3d.ts` and `DesignView`.
- **Recenter**: the button and `resetCamera`.

Esc then only deselects. Icons no longer used leave `Icon.svelte`.

- [ ] Selecting a Piece on a phone and using every toolbar button causes no error.
- [ ] `npm run check` reports no unused props.

### R3. Furnish toolbar (PR 2)

One bar, top left: **[3D | Plan]** · list · help. No second bar.

- The 3D / Plan switch shows text labels ("3D", "Plan") with their icons on every width; `iconsOnPhones` goes from this call.
- Selection toolbar: name · rotate left · rotate right · **Remove** (trash icon, `aria-label` and title "Remove (Delete)"). It puts the Piece back into the dock, as today.

### R4. Help popover (PR 2)

- **Placement**: on open, measure the button. If the popover fits to the right of the button's left edge, align their left edges; otherwise align their right edges. Recompute on window resize while open. No CSS anchor positioning.
- **Content** depends on `MediaQuery('pointer: coarse')`, as in `OnboardingHints`:
  - Pointer:
    - Drag: Move a piece; it snaps to walls and furniture (Alt: free)
    - Arrow keys: Nudge 1 cm, with Shift 10 cm
    - R: Rotate 90°
    - Delete: Remove from the room
    - Esc: Deselect
    - Ctrl Z: Undo (Ctrl Shift Z redo)
  - Touch:
    - Drag: Move a piece; it snaps to walls and furniture
    - Tap in the dock: Drop a piece in the middle
    - Pinch, two fingers: Zoom and pan
- "Show intro again" stays at the bottom in both.

- [ ] The popover is fully on screen at 360 px and on desktop.

### R5. Header stepper (PR 2)

Replaces the step tabs and the separate Publish button (onboarding R3 keeps its states, only its place changes).

```
Room Planner        1 Furnish › 2 Experience › 3 Publish        🏆 ⚖      ↶ ↷ •
```

- Shown on every page: Furnish, Experience, Designs, Duel, Design pages.
- Steps 1 and 2 are links; the current one is highlighted.
- Step 3 is the Publish button with its progress states from onboarding R3 (`n/9 placed`, conflicts, ready) and the same click behaviour (to Furnish + pulse the dock, select the first Conflict, or open the Publish dialog).
- Designs (trophy) and Duel (scales) sit to the right of the stepper, separate from it.
- Undo, redo and the saved dot stay where they are: header on desktop (editing pages only), floating above the dock on phones.
- No `flex-1` on the nav; items take their content width.
- **Phones** (< `sm`): three numbered circles joined by ›. Only the current step shows its label. Publish shows its compact progress (`3/9`, conflicts), and expands to "Publish" once ready. Designs and Duel are icon-only; "Room Planner" stays hidden below `md`.

- [ ] At 360 px the stepper, Publish and both icons fit on one line without overflow.
- [ ] Publish is visible and clickable on every page and width.

### R6. Experience shots (PR 2)

`makeShots` returns **Above → Door → Window → Corners**. Experience opens on Above (no `?shot=`), and the camera tour follows the same order.

### R7. Copy (PR 3)

First person (mine) only in the welcome card and the arrival card; hints, buttons and empty states stay neutral.

| Where            | New copy                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome title    | How would you furnish my room?                                                                                                                                              |
| Welcome body     | This is my new room in Munich, with the furniture I brought. Arrange it your way and let friends decide where they'd rather live.                                           |
| Welcome step 3   | **Publish**: send it into the Duels and make it to the top of the leaderboard!                                                                                              |
| Arrival, Design  | **{Designer} furnished my new room.** It's my room in Munich, with my furniture. Everyone gets the same pieces. Can you do better? (`Someone` without a Designer, as today) |
| Arrival, Duel    | **Help me furnish my new room.** Everyone arranged my furniture in my Munich room. Pick the one you'd rather live in.                                                       |
| Arrival, Designs | **Ideas for my new room.** Everyone arranged my furniture in my Munich room. Duels decide the ranking.                                                                      |
| `ready` hint     | Walk through your room in realistic light first, or publish it now.                                                                                                         |
| Duel, too few    | Duels need at least two designs from other people. Publish yours and check back once friends have furnished theirs.                                                         |
| Designs, empty   | Arrange the furniture, then publish it.                                                                                                                                     |

Welcome steps 1 and 2, the buttons of both cards and all other copy stay as they are.

### R8. No sharing (PR 3)

- The Share button on the Design page goes, with `share()` and `shareDescription` if nothing else uses it. Remix and Delete stay. Link previews (meta tags) stay.
- After publishing (`?published=1`) the Design page shows instead:

  > **Published!**
  > Your design is in the Duels now: friends see it next to others and pick where they'd rather live.
  >
  > [**Judge other designs**]

  The dialog is closable (✕, Esc, backdrop) and has no other button. **Judge other designs** closes it and goes to `/duel`.

- [ ] No page has a Share button or a link field.

### R9. Generic names (PR 3)

Only `name` changes in `src/lib/planner/room.ts`. Ids, sizes, colors, model files and catalog keys stay, so saved Drafts and Published Designs keep working and the Leaderboard doesn't restart (ADR 0002).

| Id / part        | Old name     | New name       |
| ---------------- | ------------ | -------------- |
| `kallax`         | Kallax       | Shelf          |
| `nymo-lamp`      | Nymo lamp    | Table lamp     |
| workstation part | Trotten desk | Standing desk  |
| workstation part | Markus chair | Office chair   |
| piano part       | Yamaha P-45  | E-piano        |
| piano part       | Z-stand      | Keyboard stand |

Catalog labels in `catalog.ts` stay as the real model names; only `/dev/models` shows them. Tests that refer to the ids don't change.

## Superseded

This spec replaces:

- **shared-designs.md**: R6 "opens the share sheet once" (now the R8 Published dialog), R7 Share button.
- **onboarding.md**: R2 welcome copy and step 3, R3 placement of the Publish button (now step 3 of the stepper, R5), R4 `ready` hint copy and the "What's next?" part of the publish dialog, R5 arrival card copy.
- **duels.md**: R4 `too-few` copy.

Each of the three specs carries a note pointing here.
