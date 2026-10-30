# Eclipse and Dionysus project workshop

The Eclipse administrator console contains Orion, Atlas, Patch, Cipher, Sentinel, Scribe, Vault, Pixel, Social, Script, Pulse and Nova. Orion coordinates the shared discussion and queue. Patch findings are assigned to Atlas. Cipher checks public security protections; Sentinel checks public endpoints. Runs execute through an isolated authenticated Firebase function and are saved in the named Firestore database. Results never include student chats or account records.

## Boundaries

- Only the two hard-coded project origins can be audited. No arbitrary target URLs or commands.
- Backend authorization uses verified owner identity, a trusted admin claim, or a server-managed admins record. Editable profile ranks do not grant access.
- Thirty workshop actions per administrator per hour, two function instances maximum, bounded request timeouts.
- These are deterministic workflow and audit agents. They do not call an LLM, edit repositories, deploy changes, send email, publish social posts, spend money or guarantee search rankings. Proposals and workflow messages are labelled honestly. Financial proposals always wait for verified owner approval. Approval records intent only, never an unspecified future payment. All approved proposals still need a connected executor.
- Dionysus is owner-private. Public audits report the sign-in gate and stop; they never bypass it.
- New source changes still use the GitHub or Sites deployment workflow.

## Validation

`npm run lint`, `npm run test:transport`, `npm run test:agents`, `npm run build`.
Security tests use demo-only Firebase emulators, never production student records: `npm run test:security` (Java 21 for the current Firebase CLI). A Java 17 environment can use Firebase CLI 13 to run the same tests.

## Remaining operational work

A signed-in owner must verify the production admin view and a real tutor conversation. Test Stripe in test mode before processing money. Review existing administrator assignments, existing shared download links, retention, account deletion, and the privacy/age-consent process before describing the service as fully audited or compliant. Files already shared using Firebase download-token URLs can remain reachable by anyone possessing those URLs until their tokens are revoked; tighter SDK rules do not revoke old URLs.

Higgsfield artwork was attempted but rejected because the account requires a Basic plan or higher. The current companions are original CSS illustrations with optional tips, pause controls and reduced-motion support. No paid plan was purchased.
