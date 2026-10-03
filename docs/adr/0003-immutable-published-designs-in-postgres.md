# Immutable Published Designs in Neon Postgres

Status: Accepted · Date: 2026-10-03

Published Designs and Likes live in Neon Postgres (via the Vercel Marketplace), accessed with Drizzle from SvelteKit server endpoints. A Published Design never changes after publishing: the only operations are publish (insert) and delete. The Draft stays in `localStorage` and never touches the server.

We rejected three alternatives. Encoding the whole Design in the URL has no place to count Likes, so it would need a second store anyway. Redis would mean hand-rolling uniqueness and queries. Editable Published Designs would let a liked design silently change under its Likes. Postgres gives Like deduplication through `UNIQUE (design_id, liker_hash)`, cascading deletes, and a Leaderboard that is a plain `ORDER BY`.
