# Room Planner

Plan how to furnish a room, then share the result with friends, who like it or remix it.

## Language

**Room**:
The shape of the space: walls, hallway corner, doors, glass front, loggia, the radiator and the ceiling lamp. Never includes furniture.
_Avoid_: layout, config, floor plan

**Inventory**:
The fixed set of real furniture that belongs to a **Room**. Every **Design** places all of it, nothing more and nothing less.
_Avoid_: catalog, furniture list

**Piece**:
One item of the **Inventory**. Its size and color are fixed; a **Design** only decides where it stands and how it is turned.
_Avoid_: item, object, furniture (as a count noun)

**Packet**:
A **Piece** made of several things that always stand together, e.g. a desk with its chair and monitor, or an e-piano on its stand with a stool. It moves and turns as one, and its footprint is the box around all its parts.
_Avoid_: group, set, bundle

**Design**:
One **Room** plus a placement of every **Piece** of its **Inventory**, with a title. The thing that gets liked, shared and remixed.
_Avoid_: layout, creation, room layout, arrangement

**Draft**:
The single **Design** being edited on this device. It lives only on the device. It starts empty: **Pieces** wait below the room until they are dragged in, and it can only be published once all of them are placed.
_Avoid_: work in progress, local layout

**Published Design**:
A frozen snapshot of a **Draft**, readable by anyone with its link. It never changes after publishing: publishing again makes a new **Published Design**.
_Avoid_: post, submission, entry

**Conflict**:
A piece of furniture that sticks out of the **Room**, overlaps another piece or blocks a door. A **Draft** with any **Conflict** cannot be published.
_Avoid_: error, issue, collision

**Remix**:
Copying a **Published Design** into the **Draft** so it can be changed. It replaces the current **Draft** after a warning.
_Avoid_: fork, copy

**Like**:
One device's vote for a **Published Design**. Each device can like a given **Published Design** at most once.
_Avoid_: vote, upvote, heart

**Designer**:
The display name attached to a **Published Design**, picked at publish time. It is a label, not an account.
_Avoid_: author, user, owner

**Device**:
One browser that has used the app. It is the only notion of identity: it publishes, likes and deletes. Clearing the browser's storage makes it a new **Device**.
_Avoid_: user, account, session

**Leaderboard**:
The list of **Published Designs** for a **Room**, ordered by **Likes** (Top) or by publish time (New).
_Avoid_: gallery, feed, ranking

## Relationships

- A **Design** belongs to exactly one **Room**. For now there is only one **Room**, and it cannot be reshaped by anyone using the app.
- A **Room** has exactly one **Inventory**. Changing the **Room** or its **Inventory** makes a new **Room** with its own **Leaderboard**.
- A **Device** has exactly one **Draft**.
- A **Published Design** comes from a **Draft** with no **Conflicts**, and may record the **Published Design** it was remixed from (direct parent only).
- A **Device** can delete the **Published Designs** it published, and their **Likes** go with them. A **Device** cannot **Like** its own.
- Viewing a **Published Design** never changes the **Draft**. Only a **Remix** does.
- A **Leaderboard** belongs to one **Room**.

## Flagged ambiguities

- "Layout" was used for both the **Room** shape and the whole **Design**. Resolved: the word is dropped.
- "Owner" is not a domain term. A **Device** that published something can delete it, but there are no accounts.
- "Furniture" in the existing code covers both free catalog boxes and real **Pieces**. In the shared flow only **Pieces** exist.
