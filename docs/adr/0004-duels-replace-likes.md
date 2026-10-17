# Duels with a Bradley-Terry ranking replace Likes

Status: Accepted · Date: 2026-10-17

The Leaderboard ranks Published Designs by Duels instead of Likes. A Duel shows a Device two Designs and asks "Where would you rather live?". The ranking is a Bradley-Terry fit over all Duel results, computed on every read. The `likes` table and `designs.like_count` are dropped.

Likes measure popularity, not quality: with a handful of friends, a Like count mostly says who saw a Design first, and nobody can say why one Design is better. A Duel forces a comparison between two concrete arrangements of the same Room, which is the question the app exists to answer.

We rejected Elo because its result depends on the order of Duels and a deleted Design's games can't be taken back. Bradley-Terry over the stored results has neither problem: deleting a Design deletes its Duels (cascade) and the next read ranks without them. We rejected star ratings because every person calibrates stars differently. Computing on read costs one query of all Designs and Duels of the Room; that is milliseconds at friend scale. If it ever isn't, cache the fit and recompute after each Duel.

What we accept: a vote can't be changed, a skipped pair never returns, and an incognito window can vote again (ADR 0001 applies to Duels as it did to Likes).
