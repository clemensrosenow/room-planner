# One fixed Room and Inventory, defined in code

Status: Accepted · Date: 2026-10-03

The goal is to find the best way to furnish one real room, so Designs must be comparable. The Room shape and the Inventory (the real pieces with their fixed sizes and colors) are hard-coded and versioned as one `roomId` (e.g. `clemens-v1`). A Design only stores position and rotation per Piece, and must place every Piece.

We rejected two alternatives: letting everyone reshape the Room or pick from the free catalog, and storing Rooms in the database. Both would make the Leaderboard compare different puzzles and add editing and admin UI. Changing measurements or furniture means adding a new `roomId` with a fresh Leaderboard, never mutating the old one. Old Published Designs would otherwise end up with Pieces inside walls.
