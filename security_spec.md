# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched under `/databases/{database}/documents` are denied (`allow read, write: if false;`).
2. **PII Isolation**: `/leaderboard_profiles/{userId}` stores strictly public game leaderboard fields (`uid`, `name`, `iconType`, `presetIcon`, `photoDataUrl`, `rankedWins`, `rankedMatches`, `balance`, `isPublic`, `createdAt`, `updatedAt`). No email, phone number, or private PII is ever stored in `/leaderboard_profiles/{userId}`.
3. **Identity & Ownership Integrity**: A `/leaderboard_profiles/{userId}` document can only be created or updated by a signed-in, email-verified user (`request.auth != null && request.auth.token.email_verified == true`) where `request.auth.uid == userId` and `incoming().uid == request.auth.uid`.
4. **Strict Key & Type Blueprint (`isValidLeaderboardProfile`)**:
   - Required & allowed keys: `['uid', 'name', 'iconType', 'presetIcon', 'photoDataUrl', 'rankedWins', 'rankedMatches', 'balance', 'isPublic', 'createdAt', 'updatedAt']`.
   - `uid`: string, size 1..128, matches `^[a-zA-Z0-9_\-]+$`, equals `request.auth.uid`.
   - `name`: string, size 1..16.
   - `iconType`: string, either `'preset'` or `'photo'`.
   - `presetIcon`: string, size 1..16.
   - `photoDataUrl`: string, size 0..120000.
   - `rankedWins`: int, `>= 0` and `<= 1000000`.
   - `rankedMatches`: int, `>= 0` and `<= 1000000`.
   - `balance`: int, `>= 0` and `<= 1000000000`.
   - `isPublic`: bool, must be `true`.
   - `createdAt`: timestamp (`request.time` on create; immutable `incoming().createdAt == existing().createdAt` on update).
   - `updatedAt`: timestamp (`request.time` on create and update).
5. **Query Enforcement (`allow list`)**: `allow list` on `/leaderboard_profiles/{userId}` explicitly checks `existing().isPublic == true` so clients must filter by `where('isPublic', '==', true)`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/leaderboard_profiles/user_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'user_1', token: { email_verified: false } }`, creating `/leaderboard_profiles/user_1` -> `PERMISSION_DENIED`.
3. **Cross-User Spoof Create**: `auth.uid = 'attacker_1'`, creating `/leaderboard_profiles/victim_1` -> `PERMISSION_DENIED`.
4. **Payload UID Mismatch**: `auth.uid = 'user_1'`, creating `/leaderboard_profiles/user_1` with `{ uid: 'someone_else' }` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Creating or updating `/leaderboard_profiles/user_1` with extra key `{ isAdmin: true }` -> `PERMISSION_DENIED`.
6. **Oversized Name String**: `name` of 50 chars (`maxLength` is 16) -> `PERMISSION_DENIED`.
7. **Oversized Photo Payload (Denial of Wallet)**: `photoDataUrl` of 250,000 chars (`maxLength` is 120000) -> `PERMISSION_DENIED`.
8. **Negative Balance or Wins**: `balance: -500` or `rankedWins: -1` -> `PERMISSION_DENIED`.
9. **Forged Client Timestamp on Create**: `createdAt: timestamp.date(2020, 1, 1)` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Mutating Immutable `createdAt` or `uid` on Update**: Changing `createdAt` or `uid` during update -> `PERMISSION_DENIED`.
11. **Invalid Document ID Poisoning**: Document ID containing spaces or special characters (`user$123!`) -> `PERMISSION_DENIED`.
12. **Unfiltered List Query on Non-Public Doc**: Listing documents where `isPublic == false` -> `PERMISSION_DENIED`.
