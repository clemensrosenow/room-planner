# Spec: Duels replace Likes

Status: Ready to build · Owner: Clemens · Date: 2026-10-17

Vocabulary follows [CONTEXT.md](../../CONTEXT.md). Decision: [ADR 0004](../adr/0004-duels-replace-likes.md). Builds on [shared-designs.md](shared-designs.md), whose Like parts (R3 `likes`, R4 like endpoints, the Like toggle in R7 and R8) this spec replaces.

## Problem Statement

Friends should find the best way to furnish the Room, not the most popular one. A Like count can't say why one Design beats another, and with a few friends it mostly rewards whoever published first. A Duel asks one Device to pick between two Designs, and the Leaderboard ranks Designs by all those picks.

## Goals

1. **Fair**: a Design is judged against other Designs, not by how often it was seen. Designer names are hidden while voting.
2. **Quick**: one tap per Duel, the next pair is already there.
3. **Honest about little data**: a Design with few Duels says so.
4. **Correct**: rank is reproducible from the stored Duels; deleting a Design removes its Duels and the ranking follows.

## Non-Goals

- Changing or undoing a vote.
- Elo, per-voter weighting, ties as a result (Skip is not a tie).
- Anti-fraud and rate limiting (ADR 0001 still applies).
- Pagination of the Leaderboard. Friend scale; all Designs come in one response.
- Comments or reasons attached to a vote.

## User Stories

- As a friend, I open `/duel`, see two Designs as floor plans side by side and tap the one I'd rather live in. The next pair appears.
- As a friend, I can't decide and skip. That pair never comes back.
- As a friend, I want to see a Design properly before voting and open it in 3D without leaving the Duel.
- As a friend, I never get my own Designs and never the same pair twice.
- As a friend, I see on the Leaderboard where each Design ranks, its wins and losses, and whether that rank is still provisional.
- Edge case: I've judged every pair available to me. The page tells me to come back in a few hours.
- Edge case: there are fewer than two Designs I'm allowed to judge. The page says there aren't enough Designs yet and asks me to publish mine.
- Edge case: a Design in my pair was deleted while I looked at it. My vote fails quietly and the next pair loads.

## Requirements

### R1. Database

```ts
duels: {
  designLo:  text not null references designs(id) on delete cascade,
  designHi:  text not null references designs(id) on delete cascade,  // designLo < designHi (string order)
  voterHash: text not null,                                             // sha256 of the Device id
  winnerId:  text,                                                      // designLo, designHi, or null = skipped
  createdAt: timestamptz(3) not null default now(),
  primary key (designLo, designHi, voterHash),
  check (designLo < designHi),
  check (winnerId is null or winnerId in (designLo, designHi)),
}
index (voterHash)
```

- The pair is stored in normalized order, so (a, b) and (b, a) are the same row. The primary key enforces "one judgement per Device per pair", also when two requests race.
- Drop the `likes` table, `designs.like_count` and `designs_top_idx` in the same migration. `designs_new_idx` stays.

### R2. Logic Clemens writes by hand

Pure functions in `src/lib/duels/`, no DB, no DOM. Tests come first (written by another agent from this section); the server calls these.

**`rank(designIds: string[], duels: { winner: string; loser: string }[]): Map<string, number>`** in `rank.ts`

Bradley-Terry strength per Design: P(a beats b) = s(a) / (s(a) + s(b)).

- [ ] Returns an entry for every id in `designIds`; ids in `duels` that aren't in `designIds` are ignored.
- [ ] Every strength is finite and > 0, also for a Design that won or lost every Duel. Prior: each Design counts as having 1 extra win and 1 extra loss against a virtual Design of strength 1.
- [ ] Normalized so the geometric mean of all strengths is 1. A Design without Duels gets exactly 1 when all others are balanced.
- [ ] Deterministic and independent of the order of `duels`.
- [ ] Monotone: replacing one of a Design's losses by a win never lowers its strength.
- [ ] Stops when the relative change is < 1e-9 or after 1000 iterations, whichever comes first; < 50 ms for 200 Designs and 5000 Duels.

**`nextPair(candidates, seen, random): [string, string] | null`** in `next-pair.ts`

```ts
candidates: {
	id: string;
	mine: boolean;
	duels: number;
	strength: number;
}
[];
seen: Set<string>; // pair keys `${lo}:${hi}` (lo < hi) this Device already judged or skipped
random: () => number; // in [0, 1), injected so tests are deterministic
```

- [ ] Never returns a Design with `mine`, never a pair in `seen`, never the same id twice. `null` when no such pair exists.
- [ ] First Design: among Designs that still have an allowed partner, those with the fewest `duels`; one of them picked with `random`.
- [ ] Second Design: among its allowed partners, the one with the closest strength (smallest |ln s(a) − ln s(b)|); ties picked with `random`.
- [ ] The returned order is shuffled with `random`, so the first-picked Design isn't always on the left.

**`castDuel(voterHash: string, a: string, b: string, winner: string | null): Promise<void>`** in `src/lib/server/duels.ts`

- [ ] 400 when `a === b`, an id isn't a valid Design id, or `winner` is neither `a`, `b` nor null.
- [ ] 404 when a Design doesn't exist, including when it is deleted between the check and the insert (foreign key violation, `23503`).
- [ ] 403 when the voter published either Design.
- [ ] 409 when this Device already judged the pair (insert hits the primary key; `on conflict do nothing` and 0 rows means 409).
- [ ] Stores the pair normalized (R1).

### R3. API (all JSON, `X-Device-Id` as today)

| Method & path                                  | Does                                                                       | Errors             |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ------------------ |
| `GET /api/designs?sort=top\|new`               | Every Design of `ROOM_ID`: Top by rank, New by `createdAt` desc            |                    |
| `GET /api/designs/:id`                         | One Design                                                                 | 404                |
| `GET /api/duel`                                | `{ pair: [DesignData, DesignData] }` / `{ pair: null, reason }` (nextPair) | 400 no Device      |
| `POST /api/duels`                              | `{ a, b, winner }` (winner = a, b or null for Skip) → 201                  | 400, 403, 404, 409 |
| `POST /api/designs`, `DELETE /api/designs/:id` | unchanged                                                                  |                    |

- `GET /api/duel` without a pair says why: `reason` is `too-few` when fewer than 2 Designs of `ROOM_ID` weren't published by this Device, otherwise `all-judged`.
- Removed: `PUT` and `DELETE /api/designs/:id/like`, the cursor and `nextCursor`.
- `DesignData` loses `likeCount` and `likedByMe` and gains:
  - `rank: number`: 1-based position by strength; equal strength → newer first, then id.
  - `wins: number`, `losses: number`: real decided Duels only. Skips and the prior's virtual win and loss (R2) never count; the prior only affects strength.
  - `provisional: boolean`: `wins + losses < 5`.
- Every read loads all Designs and Duels of `ROOM_ID` once, runs `rank`, and derives the fields. `GET /api/duel` additionally loads this Device's seen pairs and calls `nextPair`.

### R4. Duel page `/duel`

- The header gets a **Duel** link next to **Designs**.
- Heading: "Where would you rather live?"
- Two cards side by side (stacked below 640 px), each a read-only plan (`PlanThumb`) and the Design's title. The designer's name is not shown.
- Tapping a card votes for it: the card highlights briefly, then the next pair (already prefetched) slides in.
- **Skip** is a quiet text button below the cards, not a button of equal weight.
- **Look inside** (a small button per card) opens that Design read-only in a full-screen overlay (the same view as the Design page, `above` shot). Only one 3D view exists at a time. The overlay's actions replace the cards':
  - **I'd rather live here** (primary): votes for the Design on screen, closes the overlay, loads the next pair.
  - **See the other one**: switches the overlay to the other Design of the pair, so both can be walked through in turn.
  - × or Esc: back to the two plans, nothing voted.
- When `pair` is null, by `reason`:
  - `too-few`: "Not enough designs yet", "Duels need at least two designs from other people. Publish yours and share the link with friends." and the primary link "Furnish your design" to `/furnish`.
  - `all-judged`: "You've judged every pair for now. Come back in a few hours to vote on new designs." with a link "Publish your own" to `/furnish`.
- A 409 or 404 on vote loads the next pair without a message. A network error shows a toast and keeps the pair.
- `noindex`.

### R5. Leaderboard and Design page

- Leaderboard tabs stay **Top** (default, by rank) and **New**. "Load more" goes away.
- Card: plan thumbnail, title, designer, **#rank**, **W–L · win %** (`wins / (wins + losses)`, rounded; "–" with no Duels), a "provisional" badge when `provisional`, "Yours" badge, remix marker. No Like button.
- Provisional Designs rank among the others by strength; only the badge marks them.
- Design page: the Like toggle becomes rank, W–L and win %. `og:description` = "by X · Rank #N", or "by X · New" while provisional.
- Empty Leaderboard: unchanged.

### R6. Removal

- `LikeButton.svelte`, the like endpoint, `setLike`, `likedBy`, `listDesigns`' cursor code and `scripts/test-leaderboard.ts` go away.
- `scripts/test-duels.ts` (`npm run test:duels`) replaces it: against a running dev server and the Neon `dev` branch, it publishes test Designs from two Devices, casts Duels including a race on the same pair, checks rank, 403/404/409, and deletes everything it created.

## Out-of-scope follow-ups

Experience photo shoot as the Design thumbnail · clearance zones, 3D collision boxes and reachability (Season 2, new `ROOM_ID`) · a cached ranking if reads get slow.
