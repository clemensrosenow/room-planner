# Room Planner

Everyone furnishes the same Room with the same Inventory, publishes a Design, and friends Like or Remix it. SvelteKit (Svelte 5) + TailwindCSS v4 + three.js, Neon Postgres via Drizzle, deployed on Vercel. Overview: [README.md](README.md).

## Source of truth

- [CONTEXT.md](CONTEXT.md) is the vocabulary. Use its terms (Room, Inventory, Piece, Packet, Design, Draft, Published Design, Conflict, Remix, Like, Designer, Device, Leaderboard) in code, tests, commits and PRs, and avoid the words it lists under _Avoid_.
- [docs/adr](docs/adr) holds the decisions, [docs/specs](docs/specs) the specs. They win over code comments and over your own ideas.
- **A change that conflicts with an ADR stops and asks.** Don't work around it; explain the conflict and wait.

## Commands

```sh
npm run dev          # dev server
npm run check        # svelte-kit sync + svelte-check (types)
npm run lint         # prettier --check (npm run format fixes it)
npm test             # vitest run: unit tests, no DB, no DOM
npm run build        # Vercel build; needs Node 22 or 24, no DATABASE_URL
npm run db:generate  # new migration in drizzle/ after editing src/lib/server/schema.ts
npm run db:migrate   # apply migrations to the database in DATABASE_URL
```

`npm run test:leaderboard` publishes and deletes real Designs through a running dev server: it **writes data**. Only run it against the Neon `dev` branch, and only when asked.

CI (`.github/workflows/ci.yml`, job `ci`) runs check, lint, test and build on every PR. A Stop hook in `.claude/settings.json` runs `npm run check && npm test` before you finish and sends you back if they fail.

## Tests

- Vitest, files next to the code as `*.test.ts`. Only pure logic: no DOM, no three.js, no database.
- Use the real `ROOM`, `GEO` and `INVENTORY` from `src/lib/planner/room.ts` where it helps; name tests in CONTEXT.md terms (e.g. "a Piece blocking the room door is a Conflict").
- Keep `npm test` under ~10 s.

## Rules

- **Never use the production database.** Agents only get the Neon `dev` branch URL. Never run anything that writes to a database unless asked.
- Branches are `claude/*`. **Never merge, and never push to `main`.** The owner reviews and merges every PR.
- **Ask first** before editing CI config (`.github/`), schema or migrations (`src/lib/server/schema.ts`, `drizzle/`), or `ROOM_ID` / `ROOM` / `INVENTORY` in `src/lib/planner/room.ts` (ADR 0002: changing them starts a new Leaderboard).
- Every PR description shows evidence: the commands you ran, their test output, and screenshots for UI changes.
- Don't change app behaviour in a PR that is about tooling, tests or docs.

## Svelte

Use the Svelte MCP server for Svelte 5 / SvelteKit questions and code:

1. `list-sections` first, then `get-documentation` for every section whose use_cases fit the task.
2. `svelte-autofixer` on every Svelte file you write; repeat until it reports nothing.
3. `playground-link` only if the user asks, and never for code written to project files.

Edits to `.svelte` / `.svelte.ts` files go through the `svelte-file-editor` agent or the `svelte-code-writer` and `svelte-core-bestpractices` skills in `.claude/`.
