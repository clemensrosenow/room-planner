# Spec: Onboarding

Status: Draft · Owner: Clemens · Date: 2026-10-19

Vocabulary follows [CONTEXT.md](../../CONTEXT.md). Decisions: [ADR 0001](../adr/0001-device-identity-without-accounts.md) (onboarding state belongs to the Device), [ADR 0002](../adr/0002-fixed-room-and-inventory.md). Builds on [shared-designs.md](shared-designs.md) (R6 Publish flow, R7 Design page) and [duels.md](duels.md).

## Problem Statement

People who see the app for the first time don't understand what it is for or how to get from an empty Room to a Published Design. `/` drops them straight into Furnish. The only guidance is one line ("Drag your furniture from below into the room") that disappears after the first Piece. Publish looks disabled, and why it is blocked is only in a hover tooltip, which phones never show. Nothing happens when the Draft becomes publishable, so people don't know that Experience and Publish come next. Friends who open a shared link get no context at all.

## Goals

1. **Purpose in one screen**: within seconds a newcomer knows it is one real Room, everyone has the same Inventory, and Duels pick the best Design.
2. **Always know the next step**: at any moment the Draft shows what is left before it can be published.
3. **Teach at the moment of need**: each control is explained when it first matters, not in a tour up front.
4. **Zero friction stays**: nothing blocks the app. Everything can be skipped and never comes back once dismissed.
5. **Link arrivals convert**: a friend opening a Design, the Duel or the Leaderboard sees how to join.

## Non-Goals

- A multi-step spotlight tour.
- Changing the step navigation, renaming Experience, or making Publish a header step.
- Onboarding state on the server or across Devices (ADR 0001).
- Analytics, funnels or A/B tests.
- Videos or animated walkthroughs beyond the drag gesture in H1.
- Showing a top-ranked Design behind the welcome card (see follow-ups).
- Changing what blocks Publish (every Piece placed, no Conflicts). This spec only makes it visible.

## User Stories

- As a newcomer, I open the app and a short card tells me what this is and the three steps. I start furnishing with one tap.
- As a newcomer, I'd rather look first. "See what others made" takes me to the Leaderboard.
- As a newcomer, I see an empty Room and a hint showing me to drag a Piece in from below.
- As a newcomer, I select my first Piece and learn how to move and turn it.
- As a newcomer, my first Piece turns red and I'm told what a Conflict is and that I must fix it.
- As a newcomer, I always see how many Pieces are left and how many Conflicts there are, right on the Publish button.
- As a newcomer, I place the last Piece and get a clear choice: walk through it in Experience, or publish now.
- As a newcomer in Experience for the first time, I'm told how to look around and that I can publish from there.
- As a designer who just published, I'm pointed to Duels as the next thing to do.
- As a friend opening a shared Design, I learn whose it is, that I get the same Room and furniture, and that I can furnish my own, remix this one or duel.
- As the owner, I show the app to someone on my own Device and bring the intro back from the "?" popover.
- Edge case: I already had a Draft before this ships. I'm not shown the welcome card or the first-steps hints.
- Edge case: I dismiss a hint. It never shows again on this Device, even if the situation repeats.
- Edge case: I clear my browser storage. I'm a new Device, so the welcome card and hints come back.
- Edge case: "reduce motion" is on. No pulses, no gesture animation, and cards appear without movement.

## Requirements

### R1. Onboarding state (Device, `localStorage`)

- One key `room-planner-onboarding`, JSON:

```ts
type Onboarding = {
	welcomed: boolean; // the welcome card was closed in any way
	arrival: boolean; // the link-arrival card was closed in any way
	hints: Partial<Record<HintId, true>>; // dismissed or completed hints
};
type HintId = 'drag-in' | 'move-turn' | 'conflict' | 'ready' | 'experience';
```

- Module `src/lib/onboarding/state.svelte.ts` holds a single reactive instance, loads it on start and saves on every change. If storage is unavailable, everything is held in memory for the session (same as the Draft today).
- **Existing users**: on first load, if the key is missing and the Draft is not empty (`!planner.isEmpty`), write `{ welcomed: true, arrival: true, hints: { 'drag-in': true, 'move-turn': true } }`. They still get `conflict`, `ready` and `experience` if those come up.
- **Show intro again**: every "?" popover (`HelpButton`) gets a last line, a text button "Show intro again". It resets the key to `{ welcomed: false, arrival: false, hints: {} }` and opens the welcome card. It never touches the Draft. The first-steps hints (H1, H2) only trigger on an empty Room, so the owner demos the full flow in a private window. The "?" popover says nothing about this.

- [ ] Onboarding state survives reloads and is per browser.
- [ ] Resetting it never changes the Draft, its undo history or the Device id.

### R2. Welcome card

**When**: on `/furnish` or `/experience` (including through the `/` redirect) when `welcomed` is false. Never on `/d/…`, `/duel` or `/designs`; those get R5 instead.

**What**: the existing modal `Dialog` (native `<dialog>`: focus trap, Esc and backdrop close it), over the live Furnish view. Initial focus goes to the primary button.

Copy:

> **How would you furnish this room?**
>
> It's a real room, and everyone gets the same {n} pieces of real furniture. Arrange them your way, publish your design, and let friends decide where they'd rather live.
>
> 1. **Furnish**: drag every piece into the room. Move and turn them until everything fits.
> 2. **Experience**: walk through your room in realistic light. Optional.
> 3. **Publish & share**: send the link. Friends compare designs in Duels, and the best ones lead the leaderboard.
>
> [**Start furnishing**] [See what others made]

- `{n}` is `INVENTORY.length`, never hard-coded.
- Each step has the icon its feature already uses (cube, sun or eye, send). No illustrations.
- **Start furnishing**: closes the card. If it was opened on `/experience`, goes to `/furnish`. H1 may follow (R4).
- **See what others made**: closes the card and goes to `/designs`.
- Esc, the backdrop or the close button: same as closing.
- Any way of closing sets `welcomed = true`.

- [ ] It shows once per Device and never blocks: every way out takes one action.
- [ ] Under "reduce motion" it appears without the fly-in.
- [ ] On phones it fits in the viewport without scrolling (360 × 640).

### R3. Publish shows progress

Today `PublishButton` looks disabled and puts its reason in `title` and `sr-only`. Instead it always shows where the Draft stands, as visible text, on every screen size. It never looks disabled because clicking it always does something.

| Draft state               | Desktop label                | Phone label  | Style                       | Click                                                   |
| ------------------------- | ---------------------------- | ------------ | --------------------------- | ------------------------------------------------------- |
| Pieces left, no Conflicts | `5 / 11 placed`              | `5/11`       | neutral, thin progress bar  | go to `/furnish` if elsewhere, pulse the dock once      |
| Pieces left and Conflicts | `5 / 11 placed · 1 conflict` | `5/11 · 1 ⚠` | neutral, conflict part warn | same as above                                           |
| All placed, Conflicts     | `2 conflicts`                | `2 ⚠`        | warn, alert icon            | select the first conflicting Piece (existing behaviour) |
| All placed, no Conflicts  | `Publish`                    | `Publish`    | primary, send icon          | open the Publish dialog (existing behaviour)            |

- The progress bar is part of the button, filled to placed / `INVENTORY.length`.
- Becoming publishable pulses the button once (scale 1 → 1.06 → 1, 400 ms). Not under "reduce motion".
- Accessible name: the full state, e.g. "Publish: place 4 more pieces first", "Publish: resolve 2 conflicts first", "Publish". `aria-disabled` is removed.
- Changes are announced politely (`aria-live="polite"`), at most once per state change, not per drag frame.
- The dock pulse: one soft ring around the dock (600 ms). Not under "reduce motion".

- [ ] The state is readable on a phone without hovering.
- [ ] Clicking in every state does what the table says.
- [ ] Placing, putting back, undo and redo update the label right away.

### R4. Hints at key moments

A hint is a small, non-modal card with an arrow pointing at the control it explains: sheet background, `shadow-float`, the same look as the "?" popover. It has a short text, a **Got it** button and sometimes action buttons.

Rules for all hints:

- At most one hint is shown at a time. If several apply, the first one in the table below wins.
- No hint while the welcome card or any `Dialog` is open, while a drag is in progress, or within 600 ms of the previous hint closing.
- Hints never take focus. They are announced with `aria-live="polite"`, and Tab reaches their buttons.
- Esc closes the hint first, before deselecting anything (like the "?" popover does today).
- A hint is done for good on this Device when it's closed (Got it, ×, Esc, an action button) or **completed** (the user does what it explains). Both set `hints[id] = true`.
- Hints stay inside the view and flip sides when there is no room, like the selection toolbar.
- On touch screens (`pointer: coarse`) the touch copy applies.

| Id           | Shows when                                                                                         | Points at                                                    | Completed when                                    |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `conflict`   | On `/furnish`, the Draft has a Conflict after a drag or nudge ends                                 | the selection toolbar of the conflicting Piece, else Publish | the Draft has no Conflicts                        |
| `ready`      | On `/furnish`, the Draft becomes publishable (every Piece placed, no Conflicts) for the first time | Publish                                                      | the Publish dialog opens, or Experience is opened |
| `drag-in`    | On `/furnish`, the Room is empty and the dock is visible                                           | the first tile of the dock                                   | a Piece is placed                                 |
| `move-turn`  | On `/furnish`, a Piece is selected and its toolbar is visible                                      | the selection toolbar                                        | the selected Piece is rotated                     |
| `experience` | On `/experience`, after the room has loaded                                                        | the Camera bar                                               | (only closing)                                    |

Copy:

- **`drag-in`**
  - Pointer: "Drag a piece into the room, or click it to drop it in the middle."
  - Touch: "Drag a piece into the room, or tap it to drop it in the middle."
  - While shown, a hand icon moves from the first tile up into the Room and fades, three times (1.2 s each). Not under "reduce motion". The centred line "Drag your furniture from below into the room" is hidden while this hint shows and comes back if the Room is still empty afterwards.
- **`move-turn`**
  - Pointer: "Drag to move. It snaps to walls and other pieces (hold Alt to place freely). Turn it here or press R."
  - Touch: "Drag to move. It snaps to walls and other pieces. Turn it with these buttons."
- **`conflict`**: "Red means a conflict: this piece sticks out of the room, overlaps another one or blocks a door. Fix every conflict before you publish."
- **`ready`**: **"Every piece has its place."** "Walk through your room in realistic light first, or publish it now and share the link." Buttons: [**Walk through it**] goes to `/experience`, [Publish] opens the Publish dialog. Both count as completing it.
- **`experience`**
  - Pointer: "Drag to look around, ↑↓ to walk. Try the viewpoints and the time of day. Publish whenever you're happy."
  - Touch: "Drag to look around, pinch to zoom. Try the viewpoints and the time of day. Publish whenever you're happy."

After publishing, the "Published! Share it with friends" dialog on the Design page (shared-designs R7) gets a second part below the share button, shown every time:

> **What's next?** See how your design holds up: judge other designs in Duels. Yours will show up for others.
>
> [Start a Duel]

- **Start a Duel**: closes the dialog and goes to `/duel`.

- [ ] Each hint shows at most once per Device.
- [ ] A hint never covers the Piece being dragged or the selection toolbar it doesn't point at.
- [ ] The `ready` hint shows the moment the last Piece lands in a valid spot.
- [ ] With "reduce motion" on, hints appear and disappear without movement and `drag-in` has no gesture.

### R5. Context for link arrivals

**When**: on `/d/…` (only for a Design that isn't `mine`), `/duel` and `/designs`, when `arrival` is false, `welcomed` is false and the Draft is empty. Shown once per Device on whichever of these pages comes first.

**What**: a non-modal card floating at the bottom centre, `max-w-md`, full width with 16 px margin on phones, above the safe area. It never covers the Design page's top bar (title, Remix, Share) or the Duel's two choices. On `/duel` it sits above the choices and pushes them down instead of floating over them.

Copy:

- **`/d/…`**
  > **{Designer} furnished this room.** It's a real room, and everyone gets the same furniture to arrange their own way. Can you do better?
  >
  > [**Furnish your own**] [Remix this] [Duel]
  - `{Designer}` uses the same "Anonymous" fallback as the page, but here reads "Someone furnished this room."
  - **Remix this** runs the existing Remix. The Draft is empty, so it never shows the replace warning.
- **`/duel`**
  > **Designs for one real room.** Everyone furnished the same room with the same furniture. Pick the one you'd rather live in. Your picks rank the leaderboard.
  >
  > [**Got it**] [Furnish your own]
- **`/designs`**

  > **Designs for one real room.** Everyone arranged the same furniture. Duels decide the ranking.
  >
  > [**Furnish your own**] [Duel]

- **Furnish your own** goes to `/furnish`, where the welcome card (R2) still shows. The card says what this is; the welcome card says how.
- ×, Esc and every button set `arrival = true`. The card never shows again on any of the three pages.

- [ ] A friend opening a shared link sees the card once; their second page view doesn't.
- [ ] The card never appears on the Designer's own Design.
- [ ] Remix from the card lands on `/furnish` with the Design in the Draft.

### R6. Logic that is tested

Which onboarding UI shows is a pure function, in `src/lib/onboarding/next.ts`, with no DOM, no three.js and no storage access:

```ts
type Page = 'furnish' | 'experience' | 'design' | 'duel' | 'designs';

type Situation = {
	page: Page;
	state: Onboarding;
	placed: number; // Pieces in the Room
	total: number; // INVENTORY.length
	conflicts: number;
	selected: boolean; // a Piece is selected and its toolbar is visible
	dragging: boolean;
	dialogOpen: boolean;
	ownDesign: boolean; // on /d/…, the Design is mine
};

/** What to show now: the welcome card, the arrival card, one hint, or nothing. */
function nextOnboarding(s: Situation): 'welcome' | 'arrival' | HintId | null;

/** The Publish button's state from R3. */
function publishProgress(
	placed: number,
	total: number,
	conflicts: number
):
	| { kind: 'pieces'; placed: number; total: number; conflicts: number }
	| { kind: 'conflicts'; conflicts: number }
	| { kind: 'ready' };
```

`ready` and `conflict` depend on a change (the Draft _becomes_ publishable, a Conflict _appears_ after a drag). The component detects that change and passes it in via `Situation`; the function itself has no memory.

Tests next to it (`next.test.ts`), named in CONTEXT.md terms, using the real `INVENTORY`, for example:

- [ ] "a new Device on Furnish gets the welcome card"
- [ ] "an empty Room with the welcome card closed gets the drag-in hint"
- [ ] "a Conflict wins over every other hint"
- [ ] "nothing shows while a Piece is being dragged"
- [ ] "a Device's own Published Design never gets the arrival card"
- [ ] "a Draft with every Piece placed and no Conflicts is ready to publish"
- [ ] "a dismissed hint never comes back"

## Out-of-scope follow-ups (P2)

The welcome card shows the top-ranked Design slowly turning behind it · a header stepper (Furnish → Experience → Publish) · a hint after a Remix ("This is now your Draft. Change it and publish your version.") · onboarding copy in German.

## Open items

- Should "Furnish your own" from the arrival card skip the welcome card? This spec shows both, so the newcomer still sees the three steps. Revisit if it feels repetitive in testing.
- Should the `ready` hint come back every time the Draft becomes publishable again, or is the Publish pulse enough? This spec shows it once.
