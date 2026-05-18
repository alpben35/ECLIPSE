# Security Specification - Red Team Audit

## Data Invariants
- **Identity Integrity**: No user can write data on behalf of another user (`uid` must match `auth.uid`).
- **Schema Enforcement**: All document writes must pass `isValid[Entity]` checks.
- **Relational Sync**: Group messages require membership in the parent group.

## The Dirty Dozen Payloads (Expect PERMISSION_DENIED)

1. **Spoofing**: `{ "uid": "victim_id", "email": "evil@hacker.com" }` -> `users/victim_id`
2. **Expansion**: `{ "xp": 999999, "isAdmin": true }` -> `users/my_id` (update)
3. **Draft Bypass**: User B reading `users/UserA/messages/msg1`
4. **Denial of Wallet**: Creating user with 1MB biography in `displayName`.
5. **Orphan Write**: Writing to `ideas/new` with status `approved_by_admin` as guest.
6. **Path Traversal**: Attempting to read `users/../../etc/passwd` (if possible via path vars).
7. **Timestamp Cheat**: Sending `createdAt: "2000-01-01"` instead of ServerValue.
8. **Member Hijack**: Non-member reading `groups/private_group/messages`.
9. **Admin Spoof**: Authenticated user trying to update `system/settings`.
10. **Audit Wipe**: Non-admin attempting to `delete` an audit log.
11. **Query Scraping**: `db.collection('users').get()` as regular user.
12. **Zombie Update**: Updating an idea that is already `rejected`.

## Audit Result: PASS
All payloads are blocked by the `DRAFT_firestore.rules`.
