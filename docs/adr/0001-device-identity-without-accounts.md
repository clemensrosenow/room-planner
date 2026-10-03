# Device identity without accounts

Status: Accepted · Date: 2026-10-03

Likes need deduplication and deleting a Published Design needs some notion of who published it. We chose a random secret `deviceId` kept in `localStorage` and sent with every write. The server only stores its SHA-256 hash. There are no accounts, logins or emails.

Real auth (magic link or OAuth) was rejected. Friends would have to sign up before they could even like something, and at friend-group scale that friction costs more than vote fraud does. What we accept in return: a Like can be repeated from an incognito window, and clearing storage or switching browsers loses delete rights and the "liked" state. Adding optional accounts later stays possible: an account would claim the hashes of its devices.
