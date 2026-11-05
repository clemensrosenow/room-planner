# Room Planner

Plan how to furnish a room, then share the result with friends, who compare it in Duels or remix it.

## Language

**Room**:
The shape of the space: walls, hallway corner, doors, glass front, loggia, plus its **Fixtures**. Never includes **Pieces**.
_Avoid_: layout, config, floor plan

**Inventory**:
The fixed set of real furniture that belongs to a **Room**. Every **Design** places all of it, nothing more and nothing less.
_Avoid_: catalog, furniture list

**Piece**:
One item of the **Inventory**. Its size and color are fixed; a **Design** only decides where it stands and how it is turned.
_Avoid_: item, object, furniture (as a count noun)

**Packet**:
A **Piece** made of several things that always stand together, e.g. a desk with its chair and monitor, or an e-piano on its stand with a stool. It moves and turns as one, and its **Footprint** is one box around all its parts. Only the parts themselves can cause a **Conflict**, each at its own height: another **Piece** may stand in a gap between them or under the keys of the e-piano. Small things stand only on its desk top.
_Avoid_: group, set, bundle

**Footprint**:
The boxes a **Piece** takes up, each a rectangle on the plan at a range of heights. Most **Pieces** have one. A floor lamp has its foot and, higher up, its head; a plant its pot and its leaves. The first box is the foot, where the **Piece** stands and turns.
_Avoid_: hitbox, bounds, base

**Design**:
One **Room** plus a placement of every **Piece** of its **Inventory**, with a title. The thing that gets compared in **Duels**, shared and remixed.
_Avoid_: layout, creation, room layout, arrangement

**Draft**:
The single **Design** being edited on this device. It lives only on the device. It starts empty: **Pieces** wait below the room until they are dragged in, and it can only be published once all of them are placed.
_Avoid_: work in progress, local layout

**Published Design**:
A frozen snapshot of a **Draft**, readable by anyone with its link. It never changes after publishing: publishing again makes a new **Published Design**.
_Avoid_: post, submission, entry

**Conflict**:
A piece of furniture that sticks out of the **Room**, overlaps another piece at the same height or blocks a door. A door is blocked when something stands in the first 45° of its swing; the rest of the swing may be furnished. Every box of its **Footprint** counts: a floor lamp's head may reach over the bed, but not through a wall or into the wardrobe. A **Draft** with any **Conflict** cannot be published.
_Avoid_: error, issue, collision

**Remix**:
Copying a **Published Design** into the **Draft** so it can be changed. It replaces the current **Draft** after a warning.
_Avoid_: fork, copy

**Fixture**:
Something that belongs to the **Room** and never moves: the radiator, the ceiling lamp, the curtains, the loggia table and its two chairs. It is shown in every view but can't be selected, isn't part of a **Design**, and only the radiator can cause a **Conflict**.
_Avoid_: decoration, static furniture

**Duel**:
One **Device**'s judgement between two **Published Designs**: "Where would you rather live?". The result is a winner or a Skip. Each **Device** judges a given pair at most once and can't change it, and never gets its own **Published Designs**.
_Avoid_: vote, match, battle, comparison

**Rank**:
A **Published Design**'s position on the **Leaderboard**, from a Bradley-Terry fit over all **Duels** of its **Room**. With fewer than 5 decided **Duels** it is provisional.
_Avoid_: score, rating, Elo

**Designer**:
The display name attached to a **Published Design**, picked at publish time. It is a label, not an account.
_Avoid_: author, user, owner

**Device**:
One browser that has used the app. It is the only notion of identity: it publishes, judges **Duels** and deletes. Clearing the browser's storage makes it a new **Device**.
_Avoid_: user, account, session

**Leaderboard**:
The list of **Published Designs** for a **Room**, ordered by **Rank** (Top) or by publish time (New).
_Avoid_: gallery, feed, ranking

## Relationships

- A **Design** belongs to exactly one **Room**. For now there is only one **Room**, and it cannot be reshaped by anyone using the app.
- A **Room** has exactly one **Inventory**. Changing the **Room** or its **Inventory** makes a new **Room** with its own **Leaderboard**.
- A **Device** has exactly one **Draft**.
- A **Published Design** comes from a **Draft** with no **Conflicts**, and may record the **Published Design** it was remixed from (direct parent only).
- A **Device** can delete the **Published Designs** it published, and their **Duels** go with them.
- Viewing a **Published Design** never changes the **Draft**. Only a **Remix** does.
- A **Leaderboard** belongs to one **Room**.

## Flagged ambiguities

- "Layout" was used for both the **Room** shape and the whole **Design**. Resolved: the word is dropped.
- "Owner" is not a domain term. A **Device** that published something can delete it, but there are no accounts.
- "Furniture" in the existing code covers both free catalog boxes and real **Pieces**. In the shared flow only **Pieces** exist.
